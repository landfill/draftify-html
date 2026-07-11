import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import request from "supertest";
import type { SpecProject } from "@mockspec/shared";
import { buildApp } from "./app.js";
import { createProject } from "./store/projectStore.js";
import { issueToken } from "./store/tokenStore.js";

/**
 * T20: 경로 D 저장 토큰 게이트 (pathD 킥오프 §4.1, technical-spec §6).
 * snippet 프로젝트의 저장 계열(PUT·assets·export)만 Bearer 필수 — upload·proxy는 무영향.
 */

const app = buildApp();
const ROOT = "localhost:4000";

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-snipauth-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  await fs.rm(tmp, { recursive: true, force: true });
});

async function snippetProject(): Promise<{ spec: SpecProject; token: string }> {
  const spec = await createProject("확장 프로젝트", { type: "snippet" });
  const token = await issueToken(spec.id);
  return { spec, token };
}

describe("snippet 저장 토큰 게이트 (T20)", () => {
  it("PUT — 토큰 없으면 401, 유효 Bearer면 저장된다", async () => {
    const { spec, token } = await snippetProject();
    const body = { ...spec, name: "이름 변경" };

    const denied = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT).send(body);
    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe("UNAUTHORIZED");

    const ok = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`).send(body);
    expect(ok.status).toBe(200);
    expect((ok.body as SpecProject).name).toBe("이름 변경");
  });

  it("assets 업로드 — 토큰 없으면 401, 유효 Bearer면 성공", async () => {
    const { spec, token } = await snippetProject();
    const html = Buffer.from("<!doctype html><html><body>snap</body></html>");

    const denied = await request(app)
      .post(`/api/projects/${spec.id}/assets`).set("Host", ROOT)
      .attach("snapshot", html, "snap.html");
    expect(denied.status).toBe(401);

    const ok = await request(app)
      .post(`/api/projects/${spec.id}/assets`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`)
      .attach("snapshot", html, "snap.html");
    expect(ok.status).toBe(201);
    expect(ok.body.assetKey).toMatch(/^asset_/);
  });

  it("export — 토큰 없으면 401, 유효 Bearer면 HTML 반환", async () => {
    const { spec, token } = await snippetProject();

    const denied = await request(app)
      .post(`/api/projects/${spec.id}/export`).set("Host", ROOT);
    expect(denied.status).toBe(401);

    const ok = await request(app)
      .post(`/api/projects/${spec.id}/export`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toContain("text/html");
  });

  it("타 프로젝트의 유효 토큰은 거부된다", async () => {
    const a = await snippetProject();
    const b = await snippetProject();

    const res = await request(app)
      .put(`/api/projects/${a.spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${b.token}`)
      .send({ ...a.spec });
    expect(res.status).toBe(401);
  });

  it("PUT 시 X-Mockspec-Page-Origin이 lastSeenOrigin으로 스탬프되고, 클라이언트의 mockupSource 조작은 무시된다", async () => {
    const { spec, token } = await snippetProject();

    const tampered = {
      ...spec,
      name: "저장",
      mockupSource: { type: "upload", originalFilename: "fake.zip", uploadedAt: spec.createdAt },
    };
    const res = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`)
      .set("X-Mockspec-Page-Origin", "https://admin.internal.example")
      .send(tampered);
    expect(res.status).toBe(200);
    const saved = res.body as SpecProject;
    // 조작된 upload 소스는 무시되고 snippet 유지 + 페이지 오리진 스탬프
    expect(saved.mockupSource).toEqual({
      type: "snippet",
      registeredAt: (spec.mockupSource as { registeredAt: string }).registeredAt,
      lastSeenOrigin: "https://admin.internal.example",
    });

    // 헤더 없이 저장하면 기존 lastSeenOrigin 유지
    const res2 = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...saved, name: "다시 저장" });
    expect((res2.body as SpecProject).mockupSource).toEqual(saved.mockupSource);
  });

  it("GET(초기 로드)은 토큰 없이 가능 — 저장 계열만 게이트", async () => {
    const { spec } = await snippetProject();
    const res = await request(app).get(`/api/projects/${spec.id}`).set("Host", ROOT);
    expect(res.status).toBe(200);
    expect((res.body as SpecProject).id).toBe(spec.id);
  });

  it("upload 프로젝트는 기존대로 무인증 저장 (회귀 없음)", async () => {
    const spec = await createProject("zip 프로젝트", { type: "upload", originalFilename: "m.zip" });
    const res = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .send({ ...spec, name: "무인증 저장" });
    expect(res.status).toBe(200);
    expect((res.body as SpecProject).name).toBe("무인증 저장");
  });
});

describe("snippet 등록·토큰 API (T21)", () => {
  it("POST /projects {source:'snippet'} — 201 + 프로젝트 + 실제로 동작하는 토큰 1회 반환", async () => {
    const res = await request(app)
      .post("/api/projects").set("Host", ROOT)
      .send({ name: "확장 등록", source: "snippet" });
    expect(res.status).toBe(201);
    const { project, token } = res.body as { project: SpecProject; token: string };
    expect(project.mockupSource.type).toBe("snippet");
    expect(token).toMatch(/^tok_/);

    // 응답 토큰이 저장 게이트를 실제로 통과한다
    const put = await request(app)
      .put(`/api/projects/${project.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`)
      .send({ ...project, name: "저장 확인" });
    expect(put.status).toBe(200);
  });

  it("이름 없는 snippet 등록은 400", async () => {
    const res = await request(app)
      .post("/api/projects").set("Host", ROOT)
      .send({ name: "  ", source: "snippet" });
    expect(res.status).toBe(400);
  });

  it("POST /projects/:id/token — 재발급 시 구 토큰 즉시 무효, 새 토큰 유효", async () => {
    const { spec, token: oldToken } = await snippetProject();
    const res = await request(app)
      .post(`/api/projects/${spec.id}/token`).set("Host", ROOT);
    expect(res.status).toBe(201);
    const newToken = (res.body as { token: string }).token;
    expect(newToken).not.toBe(oldToken);

    const withOld = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${oldToken}`).send({ ...spec });
    expect(withOld.status).toBe(401);

    const withNew = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${newToken}`).send({ ...spec });
    expect(withNew.status).toBe(200);
  });

  it("DELETE /projects/:id/token — 폐기 후 기존 토큰 401", async () => {
    const { spec, token } = await snippetProject();
    const res = await request(app)
      .delete(`/api/projects/${spec.id}/token`).set("Host", ROOT);
    expect(res.status).toBe(204);

    const put = await request(app)
      .put(`/api/projects/${spec.id}`).set("Host", ROOT)
      .set("Authorization", `Bearer ${token}`).send({ ...spec });
    expect(put.status).toBe(401);
  });

  it("upload 프로젝트에 토큰 API를 쓰면 400", async () => {
    const spec = await createProject("zip 프로젝트", { type: "upload", originalFilename: "m.zip" });
    const post = await request(app).post(`/api/projects/${spec.id}/token`).set("Host", ROOT);
    expect(post.status).toBe(400);
    const del = await request(app).delete(`/api/projects/${spec.id}/token`).set("Host", ROOT);
    expect(del.status).toBe(400);
  });
});
