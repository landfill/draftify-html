import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import request from "supertest";
import JSZip from "jszip";
import { buildApp } from "./app.js";

const app = buildApp();

async function sampleZip(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("index.html", "<!doctype html><html><body><h1>Todo</h1></body></html>");
  zip.file("style.css", "body{margin:0}");
  zip.file("node_modules/x/i.js", "skip me");
  return zip.generateAsync({ type: "nodebuffer" });
}

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-app-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function upload(): Promise<string> {
  const res = await request(app)
    .post("/api/projects")
    .set("Host", "localhost:4000")
    .field("name", "Todo 목업")
    .attach("zip", await sampleZip(), "mockup.zip");
  expect(res.status).toBe(201);
  expect(res.body.project.id).toMatch(/^prj_[0-9a-z]+$/);
  expect(res.body.extract.excluded).toContainEqual({ pattern: "node_modules/", count: 1 });
  return res.body.project.id;
}

describe("업로드 → 서브도메인 서빙 → SDK 주입 (T2 AC)", () => {
  it("zip 업로드 후 서브도메인 루트에서 목업이 열리고 SDK 태그가 주입된다", async () => {
    const id = await upload();
    const res = await request(app).get("/").set("Host", `${id}.localhost:4000`);
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain("<h1>Todo</h1>");                  // 원본 유지
    expect(res.text).toContain('src="/__mockspec/sdk.js"');        // 주입됨
    expect(res.text).toContain(`data-project="${id}"`);
    expect(res.text.indexOf("sdk.js")).toBeLessThan(res.text.indexOf("</body>"));
  });

  it("정적 자산은 주입 없이 그대로 서빙된다", async () => {
    const id = await upload();
    const res = await request(app).get("/style.css").set("Host", `${id}.localhost:4000`);
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/css");
    expect(res.text).toContain("margin:0");
    expect(res.text).not.toContain("sdk.js");
  });

  it("/__mockspec/sdk.js 예약 경로가 서빙된다", async () => {
    const id = await upload();
    const res = await request(app).get("/__mockspec/sdk.js").set("Host", `${id}.localhost:4000`);
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/javascript/);
  });

  it("확장자 없는 미존재 경로는 index.html로 SPA fallback (주입 포함)", async () => {
    const id = await upload();
    const res = await request(app).get("/todos/42").set("Host", `${id}.localhost:4000`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("<h1>Todo</h1>");
    expect(res.text).toContain('src="/__mockspec/sdk.js"');
  });

  it("확장자 있는 미존재 파일은 404 + 에러 표준", async () => {
    const id = await upload();
    const res = await request(app).get("/missing.png").set("Host", `${id}.localhost:4000`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("SDK는 same-origin /__mockspec/api 로 프로젝트를 읽는다", async () => {
    const id = await upload();
    const res = await request(app)
      .get(`/__mockspec/api/projects`)
      .set("Host", `${id}.localhost:4000`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: { id: string }) => p.id === id)).toBe(true);
  });

  it("루트 도메인 목록 API가 업로드한 프로젝트를 반환한다", async () => {
    const id = await upload();
    const res = await request(app).get("/api/projects").set("Host", "localhost:4000");
    expect(res.status).toBe(200);
    expect(res.body.some((p: { id: string }) => p.id === id)).toBe(true);
  });
});
