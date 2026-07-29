import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import type { SpecProject, Scene, Annotation } from "@mockspec/shared";
import { createSupabaseAdminClient } from "../supabase/admin.js";
import type { Database } from "../supabase/database.types.js";
import { loadWebEnvLocal, hasSupabaseIntegrationEnv } from "../test/load-env.js";
import type { Db } from "./ids.js";
import {
  createProject,
  readSpec,
  listProjects,
  replaceSpec,
  deleteProject,
  saveAsset,
  readAsset,
} from "./projectStore.js";
import { issueToken, verifyToken, revokeToken, hasToken } from "./tokenStore.js";
import { appendExportRecord, readExportRecords, exportSummary } from "./exportStore.js";

loadWebEnvLocal();
const RUN = hasSupabaseIntegrationEnv();

function scene(over: Partial<Scene> = {}): Scene {
  return { id: "scn_a", code: "SCR-001", title: "화면", route: "/", order: 0, annoNumberSeq: 1, ...over };
}

function anno(over: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann_a",
    sceneId: "scn_a",
    number: 1,
    title: "설명",
    description: "본문",
    anchor: {
      selector: "#root > button",
      text: "저장",
      attrs: { role: "button" },
      rect: { x: 0.1, y: 0.2, w: 0.3, h: 0.05 },
    },
    ...over,
  };
}

describe.skipIf(!RUN)("supabase store adapters (W2 integration)", () => {
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  let userDb: Db;
  let testUserId: string;
  const projectIds: string[] = [];

  beforeAll(async () => {
    admin = createSupabaseAdminClient();
    const email = `w2-it-${Date.now()}@draftify.invalid`;
    const password = `T_${crypto.randomBytes(18).toString("base64url")}!a1`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created.user) throw createErr ?? new Error("createUser failed");
    testUserId = created.user.id;

    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    userDb = anon as unknown as Db;
  }, 30_000);

  afterAll(async () => {
    for (const id of projectIds) {
      await deleteProject(admin as unknown as Db, id).catch(() => undefined);
    }
    if (testUserId) await admin.auth.admin.deleteUser(testUserId).catch(() => undefined);
  }, 30_000);

  it("admin 클라이언트가 secret 키로 생성되고 RLS를 우회한다", async () => {
    const { count, error } = await admin.from("projects").select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("projectStore create/read/list/replace 왕복 무손실", async () => {
    const project = await createProject(userDb, "통합 테스트", {
      type: "upload",
      originalFilename: "demo.zip",
    });
    projectIds.push(project.id);

    const loaded = await readSpec(userDb, project.id);
    expect(loaded).toEqual(project);
    expect((await listProjects(userDb)).some((p) => p.id === project.id)).toBe(true);

    const next: SpecProject = {
      ...project,
      name: "수정된 이름",
      sceneCodeSeq: 2,
      scenes: [scene()],
      annotations: [anno()],
    };
    const saved = await replaceSpec(userDb, project, next);
    expect(saved.name).toBe("수정된 이름");
    const reloaded = await readSpec(userDb, project.id);
    const { updatedAt: _a, ...expected } = saved;
    const { updatedAt: _b, ...actual } = reloaded!;
    expect(actual).toEqual(expected);
  });

  it("projectStore asset save/read 및 replaceSpec 고아 GC", async () => {
    const project = await createProject(userDb, "asset 테스트", { type: "snippet" });
    projectIds.push(project.id);
    const key = await saveAsset(userDb, project.id, new Uint8Array([1, 2, 3]));
    const bytes = await readAsset(userDb, project.id, key);
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));

    const withAsset: SpecProject = {
      ...project,
      scenes: [scene({ snapshotAsset: key })],
    };
    await replaceSpec(userDb, project, withAsset);
    const withoutAsset: SpecProject = { ...withAsset, scenes: [scene()] };
    await replaceSpec(userDb, withAsset, withoutAsset);
    expect(await readAsset(userDb, project.id, key)).toBeNull();
  });

  it("exportStore append/read/summary 왕복 무손실", async () => {
    const project = await createProject(userDb, "export 테스트", { type: "snippet" });
    projectIds.push(project.id);
    const record = await appendExportRecord(userDb, project.id, {
      specUpdatedAt: project.updatedAt,
      bytes: 1234,
      masked: false,
    });
    const records = await readExportRecords(userDb, project.id);
    expect(records).toEqual([record]);
    expect(await exportSummary(userDb, project.id)).toEqual({
      exportCount: 1,
      lastExportAt: record.createdAt,
    });
  });

  it("tokenStore issue/has/verify(admin)/revoke", async () => {
    const project = await createProject(userDb, "token 테스트", { type: "snippet" });
    projectIds.push(project.id);
    expect(await hasToken(userDb, project.id)).toBe(false);

    const token = await issueToken(userDb, project.id);
    expect(await hasToken(userDb, project.id)).toBe(true);
    expect(await verifyToken(admin as unknown as Db, project.id, token)).toBe(true);
    expect(await verifyToken(admin as unknown as Db, project.id, "tok_bad")).toBe(false);

    await revokeToken(userDb, project.id);
    expect(await hasToken(userDb, project.id)).toBe(false);
    expect(await verifyToken(admin as unknown as Db, project.id, token)).toBe(false);
  });
});
