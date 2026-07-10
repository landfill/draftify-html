import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import request from "supertest";
import JSZip from "jszip";
import type { SpecProject, Scene, Annotation } from "@mockspec/shared";
import { buildApp } from "./app.js";

const app = buildApp();
const ROOT = "localhost:4000";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-store-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function newProject(): Promise<SpecProject> {
  const zip = new JSZip();
  zip.file("index.html", "<!doctype html><html><body>x</body></html>");
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const res = await request(app).post("/api/projects").set("Host", ROOT).attach("zip", buf, "m.zip");
  return res.body.project as SpecProject;
}

function scene(over: Partial<Scene> = {}): Scene {
  return { id: "scn_a", code: "SCR-001", title: "장면", route: "/", order: 0, annoNumberSeq: 1, ...over };
}
function anno(over: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann_a", sceneId: "scn_a", number: 1, title: "설명",
    description: "본문 **마크다운**",
    anchor: { selector: "#root > button:nth-of-type(1)", text: "저장", attrs: { role: "button" }, rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.05 } },
    markerOffset: { dx: -12, dy: 30 }, // 마커 드래그 오프셋도 왕복 무손실이어야 한다 (4차 개정)
    ...over,
  };
}

describe("Spec API (T3)", () => {
  it("GET /:id — 없으면 404, 있으면 spec 반환", async () => {
    const notFound = await request(app).get("/api/projects/prj_none").set("Host", ROOT);
    expect(notFound.status).toBe(404);
    expect(notFound.body.error.code).toBe("NOT_FOUND");

    const p = await newProject();
    const got = await request(app).get(`/api/projects/${p.id}`).set("Host", ROOT);
    expect(got.status).toBe(200);
    expect(got.body.id).toBe(p.id);
  });

  it("PUT /:id — 전체 교체 왕복 무손실 (updatedAt만 서버 갱신)", async () => {
    const p = await newProject();
    const next: SpecProject = {
      ...p,
      name: "수정된 이름",
      sceneCodeSeq: 2,
      scenes: [scene()],
      annotations: [anno()],
    };
    const put = await request(app).put(`/api/projects/${p.id}`).set("Host", ROOT).send(next);
    expect(put.status).toBe(200);

    const got = await request(app).get(`/api/projects/${p.id}`).set("Host", ROOT);
    // updatedAt 제외하고 완전 일치
    const { updatedAt: _a, ...expected } = next;
    const { updatedAt: _b, ...actual } = got.body as SpecProject;
    expect(actual).toEqual(expected);
    expect(got.body.annotations[0].anchor.rect).toEqual({ x: 0.1, y: 0.2, w: 0.3, h: 0.05 });
  });

  it("PUT /:id — version·id 불일치는 400", async () => {
    const p = await newProject();
    const badVersion = await request(app).put(`/api/projects/${p.id}`).set("Host", ROOT).send({ ...p, version: 2 });
    expect(badVersion.status).toBe(400);
    const badId = await request(app).put(`/api/projects/${p.id}`).set("Host", ROOT).send({ ...p, id: "prj_other" });
    expect(badId.status).toBe(400);
    const missing = await request(app).put(`/api/projects/prj_none`).set("Host", ROOT).send({ ...p, id: "prj_none" });
    expect(missing.status).toBe(404);
  });

  it("DELETE /:id — 204 후 GET 404", async () => {
    const p = await newProject();
    const del = await request(app).delete(`/api/projects/${p.id}`).set("Host", ROOT);
    expect(del.status).toBe(204);
    const got = await request(app).get(`/api/projects/${p.id}`).set("Host", ROOT);
    expect(got.status).toBe(404);
  });

  it("asset POST/GET — 업로드 후 키로 조회", async () => {
    const p = await newProject();
    const post = await request(app)
      .post(`/api/projects/${p.id}/assets`).set("Host", ROOT)
      .attach("snapshot", Buffer.from("<html><body>frozen</body></html>"), "snap.html");
    expect(post.status).toBe(201);
    expect(post.body.assetKey).toMatch(/^asset_[0-9a-z]+$/);

    const get = await request(app).get(`/api/projects/${p.id}/assets/${post.body.assetKey}`).set("Host", ROOT);
    expect(get.status).toBe(200);
    expect(get.text).toContain("frozen");
  });

  it("ID-11 — 장면이 참조를 놓은 asset은 PUT 시 즉시 삭제된다", async () => {
    const p = await newProject();
    const post = await request(app)
      .post(`/api/projects/${p.id}/assets`).set("Host", ROOT)
      .attach("snapshot", Buffer.from("<html><body>snap</body></html>"), "s.html");
    const key = post.body.assetKey as string;

    // 장면이 asset을 참조
    await request(app).put(`/api/projects/${p.id}`).set("Host", ROOT)
      .send({ ...p, scenes: [scene({ snapshotAsset: key })] });
    expect((await request(app).get(`/api/projects/${p.id}/assets/${key}`).set("Host", ROOT)).status).toBe(200);

    // 장면 삭제 → 참조 사라짐 → asset 즉시 삭제
    await request(app).put(`/api/projects/${p.id}`).set("Host", ROOT).send({ ...p, scenes: [] });
    expect((await request(app).get(`/api/projects/${p.id}/assets/${key}`).set("Host", ROOT)).status).toBe(404);
  });

  it("asset 키 형식 위반은 404 (경로 이탈 차단)", async () => {
    const p = await newProject();
    const res = await request(app).get(`/api/projects/${p.id}/assets/..%2f..%2fspec.json`).set("Host", ROOT);
    expect(res.status).toBe(404);
  });
});
