import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import request from "supertest";
import JSZip from "jszip";
import type { Annotation, Scene, SpecProject } from "@mockspec/shared";
import { buildApp } from "./app.js";
import { buildExportHtml, type SnapshotBundle } from "./routes/export.js";

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

  it("프로젝트가 없으면 표준 404를 반환한다", async () => {
    const res = await request(app).post("/api/projects/prj_none/export").set("Host", ROOT);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
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
