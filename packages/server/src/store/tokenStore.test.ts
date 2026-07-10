import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { issueToken, verifyToken, revokeToken, hasToken } from "./tokenStore.js";
import { createProject, readSpec, deleteProject } from "./projectStore.js";
import { tokenFile } from "./paths.js";

/**
 * T19: 경로 D 토큰 발급·검증·폐기 (pathD 킥오프 §4.1·§8-2).
 * 토큰은 spec.json 밖 별도 메타에 해시만 — 발급 평문은 1회 반환.
 */

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-token-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("tokenStore (경로 D)", () => {
  it("발급한 토큰이 검증을 통과하고, 다른 토큰·미발급은 거부된다", async () => {
    const project = await createProject("확장 프로젝트", { type: "snippet" });
    expect(await verifyToken(project.id, "tok_whatever")).toBe(false); // 미발급

    const token = await issueToken(project.id);
    expect(token).toMatch(/^tok_[A-Za-z0-9_-]{32}$/);
    expect(await verifyToken(project.id, token)).toBe(true);
    expect(await verifyToken(project.id, "tok_wrongwrongwrongwrongwrongwrong")).toBe(false);
    expect(await verifyToken(project.id, "")).toBe(false);
  });

  it("메타 파일에는 해시만 있고 평문 토큰이 없다 (spec.json에도 없음)", async () => {
    const project = await createProject("확장 프로젝트", { type: "snippet" });
    const token = await issueToken(project.id);

    const metaRaw = await fs.readFile(tokenFile(project.id), "utf8");
    expect(metaRaw).not.toContain(token);
    const meta = JSON.parse(metaRaw) as { tokenHash: string; issuedAt: string };
    expect(meta.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(typeof meta.issuedAt).toBe("string");

    const spec = await readSpec(project.id);
    expect(JSON.stringify(spec)).not.toContain(token);
    expect(JSON.stringify(spec)).not.toContain(meta.tokenHash);
  });

  it("재발급하면 구 토큰이 즉시 무효가 된다", async () => {
    const project = await createProject("확장 프로젝트", { type: "snippet" });
    const first = await issueToken(project.id);
    const second = await issueToken(project.id);

    expect(first).not.toBe(second);
    expect(await verifyToken(project.id, first)).toBe(false);
    expect(await verifyToken(project.id, second)).toBe(true);
  });

  it("폐기하면 검증이 거부되고, hasToken이 발급 상태를 반영한다", async () => {
    const project = await createProject("확장 프로젝트", { type: "snippet" });
    expect(await hasToken(project.id)).toBe(false);

    const token = await issueToken(project.id);
    expect(await hasToken(project.id)).toBe(true);

    await revokeToken(project.id);
    expect(await hasToken(project.id)).toBe(false);
    expect(await verifyToken(project.id, token)).toBe(false);
  });

  it("프로젝트 삭제 시 토큰 메타도 함께 정리된다 (projectDir 하위)", async () => {
    const project = await createProject("확장 프로젝트", { type: "snippet" });
    await issueToken(project.id);
    await deleteProject(project.id);
    expect(await hasToken(project.id)).toBe(false);
  });

  it("snippet 프로젝트 생성 — mockupSource가 계약 형태로 저장된다 (왕복 무손실)", async () => {
    const project = await createProject("확장 프로젝트", { type: "snippet" });
    expect(project.mockupSource).toEqual({
      type: "snippet",
      registeredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown as string,
    });
    const reloaded = await readSpec(project.id);
    expect(reloaded).toEqual(project);
  });
});
