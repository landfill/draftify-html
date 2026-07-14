import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import request from "supertest";
import JSZip from "jszip";
import type { Annotation, Scene, SpecProject } from "@mockspec/shared";
import { buildApp } from "./app.js";
import { buildExportHtml, type SnapshotBundle } from "./routes/export.js";
import { appendExportRecord, readExportRecords } from "./store/exportStore.js";

const app = buildApp();
const ROOT = "localhost:4000";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-export-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
  process.env.MOCKSPEC_VIEWER_SCRIPT = "window.__mockspecViewerLoaded = true;";
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  delete process.env.MOCKSPEC_VIEWER_SCRIPT;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function newProject(): Promise<SpecProject> {
  const zip = new JSZip();
  zip.file("index.html", "<!doctype html><html><body><h1>Todo</h1></body></html>");
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const res = await request(app)
    .post("/api/projects")
    .set("Host", ROOT)
    .field("name", "주문 개편")
    .attach("zip", buf, "mockup.zip");
  expect(res.status).toBe(201);
  return res.body.project as SpecProject;
}

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scn_export",
    code: "SCR-001",
    title: "홈",
    route: "/",
    order: 0,
    annoNumberSeq: 2,
    ...overrides,
  };
}

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann_export",
    sceneId: "scn_export",
    number: 1,
    title: "검색어 입력",
    description: "2자 이상 입력하면 **자동완성**을 표시한다.",
    policyRefs: ["POL-014"],
    anchor: {
      selector: "#search",
      text: "검색",
      attrs: { role: "button" },
      rect: { x: 0.1, y: 0.2, w: 0.2, h: 0.05 },
    },
    ...overrides,
  };
}

describe("export API (T8)", () => {
  it("spec JSON, base64 snapshot, viewer JS를 단일 HTML로 조립한다", async () => {
    const project = await newProject();
    const snapshotHtml = "<!doctype html><html><body><button id=\"search\" role=\"button\">검색</button></body></html>";
    const asset = await request(app)
      .post(`/api/projects/${project.id}/assets`)
      .set("Host", ROOT)
      .attach("snapshot", Buffer.from(snapshotHtml), "snapshot.html");
    expect(asset.status).toBe(201);

    const next: SpecProject = {
      ...project,
      scenes: [scene({ snapshotAsset: asset.body.assetKey as string })],
      annotations: [annotation()],
    };
    const put = await request(app).put(`/api/projects/${project.id}`).set("Host", ROOT).send(next);
    expect(put.status).toBe(200);

    const res = await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT);
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.text).toContain('id="spec-data"');
    expect(res.text).toContain('data-snapshot="scn_export"');
    expect(res.text).toContain("window.__mockspecViewerLoaded = true;");

    const specMatch = res.text.match(/id="spec-data">([^<]+)<\/script>/);
    expect(specMatch).not.toBeNull();
    const embeddedSpec = JSON.parse(specMatch![1]!) as SpecProject;
    expect(embeddedSpec.scenes[0]?.snapshotAsset).toBe(asset.body.assetKey);
    expect(embeddedSpec.annotations[0]?.description).toContain("자동완성");

    const snapMatch = res.text.match(/data-snapshot="scn_export"[^>]*>([^<]+)<\/script>/);
    expect(snapMatch).not.toBeNull();
    expect(Buffer.from(snapMatch![1]!, "base64").toString("utf8")).toBe(snapshotHtml);
  });

  it("스냅샷 없는 장면도 산출물에 spec으로 남기고 snapshot 태그는 만들지 않는다", async () => {
    const project = await newProject();
    await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Host", ROOT)
      .send({ ...project, scenes: [scene()], annotations: [] });

    const res = await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT);
    expect(res.status).toBe(200);
    expect(res.text).toContain("SCR-001");
    expect(res.text).not.toContain('data-snapshot="scn_export"');
  });

  it("마스킹된 스냅샷(maskedSnapshotAsset)이 있으면 원본보다 우선하여 조립한다 (T16)", async () => {
    const project = await newProject();
    
    const originalHtml = "<!doctype html><html><body><h1>홍길동 님 환영합니다</h1></body></html>";
    const maskedHtml = "<!doctype html><html><body><h1>고객명 님 환영합니다</h1></body></html>";
    
    // 원본 스냅샷 업로드
    const origAssetRes = await request(app)
      .post(`/api/projects/${project.id}/assets`)
      .set("Host", ROOT)
      .attach("snapshot", Buffer.from(originalHtml), "snapshot.html");
    const origKey = origAssetRes.body.assetKey;

    // 마스킹 스냅샷 업로드
    const maskAssetRes = await request(app)
      .post(`/api/projects/${project.id}/assets`)
      .set("Host", ROOT)
      .attach("snapshot", Buffer.from(maskedHtml), "snapshot.html");
    const maskKey = maskAssetRes.body.assetKey;

    // 프로젝트 업데이트
    const next: SpecProject = {
      ...project,
      scenes: [scene({ snapshotAsset: origKey, maskedSnapshotAsset: maskKey })],
      annotations: [],
      maskingRules: [{ id: "msk_test", find: "홍길동", replace: "고객명" }]
    };
    await request(app).put(`/api/projects/${project.id}`).set("Host", ROOT).send(next);

    // Export 요청
    const res = await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT);
    expect(res.status).toBe(200);
    
    const snapMatch = res.text.match(/data-snapshot="scn_export"[^>]*>([^<]+)<\/script>/);
    expect(snapMatch).not.toBeNull();
    const exportedHtml = Buffer.from(snapMatch![1]!, "base64").toString("utf8");
    
    expect(exportedHtml).toBe(maskedHtml);
    expect(exportedHtml).toContain("고객명");
    expect(exportedHtml).not.toContain("홍길동");
  });

  it("프로젝트가 없으면 표준 404를 반환한다", async () => {
    const res = await request(app).post("/api/projects/prj_none/export").set("Host", ROOT);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("export 성공 시 산출물 이력(메타)을 기록하고 목록 요약에 반영한다 (T29, FR-EXP-08)", async () => {
    const project = await newProject();
    await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Host", ROOT)
      .send({ ...project, scenes: [scene()], annotations: [] });

    // export 전에는 이력 요약이 0
    let list = await request(app).get("/api/projects").set("Host", ROOT);
    expect(list.body[0].exportCount).toBe(0);
    expect(list.body[0].lastExportAt).toBeUndefined();

    await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT).expect(200);
    await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT).expect(200);

    // 두 번 내보내면 이력 요약이 2회로 누적된다 (산출물 파일은 보관하지 않음 — 메타만)
    list = await request(app).get("/api/projects").set("Host", ROOT);
    expect(list.body[0].exportCount).toBe(2);
    expect(typeof list.body[0].lastExportAt).toBe("string");

    // 이력 파일은 spec.json 밖 서버 소유 별도 파일(exports.json)에 쌓인다 (§6.3)
    const raw = await fs.readFile(path.join(tmp, "projects", project.id, "exports.json"), "utf8");
    const records = JSON.parse(raw) as Array<{ id: string; bytes: number; masked: boolean }>;
    expect(records).toHaveLength(2);
    expect(records[0]!.id).toMatch(/^exp_/);
    expect(records[0]!.bytes).toBeGreaterThan(0);
    expect(records[0]!.masked).toBe(false);
  });

  it("마스킹본을 내보내면 이력 masked=true로 기록된다 (T29)", async () => {
    const project = await newProject();
    const orig = await request(app)
      .post(`/api/projects/${project.id}/assets`)
      .set("Host", ROOT)
      .attach("snapshot", Buffer.from("<!doctype html><html><body>홍길동</body></html>"), "s.html");
    const masked = await request(app)
      .post(`/api/projects/${project.id}/assets`)
      .set("Host", ROOT)
      .attach("snapshot", Buffer.from("<!doctype html><html><body>고객</body></html>"), "s.html");
    await request(app)
      .put(`/api/projects/${project.id}`)
      .set("Host", ROOT)
      .send({
        ...project,
        scenes: [scene({ snapshotAsset: orig.body.assetKey, maskedSnapshotAsset: masked.body.assetKey })],
        annotations: [],
        maskingRules: [{ id: "msk_t", find: "홍길동", replace: "고객" }],
      });

    await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT).expect(200);

    const raw = await fs.readFile(path.join(tmp, "projects", project.id, "exports.json"), "utf8");
    const records = JSON.parse(raw) as Array<{ masked: boolean }>;
    expect(records[0]!.masked).toBe(true);
  });

  it("동시 append(더블클릭 등)에도 이력이 유실되지 않는다 — 프로젝트별 쓰기 직렬화 (리뷰 반영)", async () => {
    const project = await newProject();
    // 같은 프로젝트에 병렬 10건 — 직렬화 없으면 read-modify-write 교차로 유실된다
    await Promise.all(
      Array.from({ length: 10 }, () =>
        appendExportRecord(project.id, { specUpdatedAt: project.updatedAt, bytes: 1, masked: false }),
      ),
    );
    const records = await readExportRecords(project.id);
    expect(records).toHaveLength(10);
    expect(new Set(records.map((r) => r.id)).size).toBe(10); // 전부 고유
  });

  it("손상된 exports.json은 빈 이력으로 취급하고 목록 조회를 깨뜨리지 않는다 — 자가 치유 (리뷰 반영)", async () => {
    const project = await newProject();
    const file = path.join(tmp, "projects", project.id, "exports.json");
    await fs.writeFile(file, "{ 깨진 JSON", "utf8");

    // GET /projects가 500이 아니라 정상 응답, 손상 프로젝트는 이력 0으로
    const list = await request(app).get("/api/projects").set("Host", ROOT);
    expect(list.status).toBe(200);
    expect(list.body[0].exportCount).toBe(0);

    // 다음 export가 정상 JSON으로 덮어써 자가 치유
    await request(app).post(`/api/projects/${project.id}/export`).set("Host", ROOT).expect(200);
    const healed = await readExportRecords(project.id);
    expect(healed).toHaveLength(1);
  });
});

describe("buildExportHtml", () => {
  it("JSON script 안의 HTML 종료 시퀀스를 이스케이프한다", () => {
    const project: SpecProject = {
      version: 1,
      id: "prj_escape",
      name: "</script><img src=x>",
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
      mockupSource: { type: "upload", originalFilename: "x.zip", uploadedAt: "2026-07-07T00:00:00.000Z" },
      sceneCodeSeq: 1,
      scenes: [],
      annotations: [],
    };
    const snapshots: SnapshotBundle[] = [];
    const html = buildExportHtml({ project, snapshots, viewerScript: "", generatedAt: "2026-07-07T00:00:00.000Z" });
    expect(html).not.toContain("</script><img src=x>");
    expect(html).toContain("\\u003c/script\\u003e");
  });
});
