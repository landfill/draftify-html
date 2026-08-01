import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import type { SpecProject, Scene, Annotation } from "@mockspec/shared";
import { createSupabaseAdminClient } from "../supabase/admin.js";
import type { Database, Json } from "../supabase/database.types.js";
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
import {
  appendExportRecord,
  readExportRecords,
  exportSummary,
  exportSummaries,
} from "./exportStore.js";
import { listProjectsForConsole } from "./projectList.js";

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

  /**
   * 생성은 관리 클라이언트 + 명시적 ownerId로만 가능하다(#45 — projects에 INSERT 정책이 없다).
   * 읽기·수정·삭제는 그대로 요청 스코프 `userDb`를 써서 RLS 격리를 검증한다.
   */
  function newProject(
    name: string,
    source: Parameters<typeof createProject>[3],
    ownerLabel?: string,
  ) {
    return createProject(admin as unknown as Db, testUserId, name, source, ownerLabel);
  }

  it("admin 클라이언트가 secret 키로 생성되고 RLS를 우회한다", async () => {
    const { count, error } = await admin.from("projects").select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("projectStore create/read/list/replace 왕복 무손실", async () => {
    const project = await newProject("통합 테스트", {
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
    const project = await newProject("asset 테스트", { type: "snippet" });
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
    const project = await newProject("export 테스트", { type: "snippet" });
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

  it("listProjectsForConsole — 요약을 한 번에 모으고 0회 프로젝트도 빠뜨리지 않는다 (#81)", async () => {
    // 두 프로젝트: 하나는 export 2회, 하나는 0회. 0회가 목록에서 사라지면 안 된다.
    const twice = await newProject("요약 일괄 A", { type: "snippet" });
    projectIds.push(twice.id);
    const never = await newProject("요약 일괄 B", { type: "snippet" });
    projectIds.push(never.id);

    const first = await appendExportRecord(userDb, twice.id, {
      specUpdatedAt: twice.updatedAt,
      bytes: 10,
      masked: false,
    });
    const second = await appendExportRecord(userDb, twice.id, {
      specUpdatedAt: twice.updatedAt,
      bytes: 20,
      masked: true,
    });

    const summaries = await exportSummaries(userDb, [twice.id, never.id]);
    expect(summaries.get(twice.id)).toEqual({
      exportCount: 2,
      // 가장 마지막 것 — 두 레코드 중 큰 createdAt
      lastExportAt: first.createdAt > second.createdAt ? first.createdAt : second.createdAt,
    });
    // export가 없는 프로젝트는 맵에 담기지 않는다(호출부가 0으로 채운다).
    expect(summaries.has(never.id)).toBe(false);

    // 빈 입력에 쿼리를 날리지 않는다 — `.in()`에 빈 배열을 주면 결과가 비는 대신 왕복만 쓴다.
    expect((await exportSummaries(userDb, [])).size).toBe(0);

    // 조합 함수는 0회를 exportCount: 0으로 채워 넣는다 (라우트·RSC가 같이 쓰는 계약).
    const listed = await listProjectsForConsole(userDb);
    const byId = new Map(listed.map((p) => [p.id, p]));
    expect(byId.get(twice.id)?.exportCount).toBe(2);
    expect(byId.get(never.id)?.exportCount).toBe(0);
    expect(byId.get(never.id)?.lastExportAt).toBeUndefined();
  });

  it("tokenStore issue/has/verify(admin)/revoke", async () => {
    const project = await newProject("token 테스트", { type: "snippet" });
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

  // 이슈 #47 — 재발급이 delete + insert 2단계였을 때는 동시 요청이 행을 2개 남겼고,
  // verifyToken()의 maybeSingle()이 에러를 내 발급된 토큰이 **전부** 무효가 됐다.
  // (콘솔의 [토큰 재발급] 더블클릭만으로 재현된다.)
  it("tokenStore 동시 재발급 — 행 1개만 남고 나중 발급이 앞선 토큰을 무효화한다 (#47)", async () => {
    const project = await newProject("token 경합", { type: "snippet" });
    projectIds.push(project.id);

    const tokens = await Promise.all([
      issueToken(userDb, project.id),
      issueToken(userDb, project.id),
      issueToken(userDb, project.id),
    ]);
    expect(new Set(tokens).size).toBe(3); // 서로 다른 평문이 발급됐다

    const { count, error } = await admin
      .from("project_tokens")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id);
    expect(error).toBeNull();
    expect(count).toBe(1);

    const valid = await Promise.all(
      tokens.map((t) => verifyToken(admin as unknown as Db, project.id, t)),
    );
    expect(valid.filter(Boolean)).toHaveLength(1);
    expect(await hasToken(userDb, project.id)).toBe(true);

    // 위 단정은 "셋 중 하나만 유효"까지만 말한다 — `Promise.all`이 돌려주는 배열 순서는
    // upsert 완료 순서가 아니므로, 경합만으로는 *나중* 발급이 이겼는지 알 수 없다(첫 요청의
    // 토큰이 남는 구현도 통과한다. #63). 순서가 확정된 재발급을 한 번 더 걸어, 그 토큰만
    // 유효하고 앞선 것은 전부 무효임을 못 박는다.
    const finalToken = await issueToken(userDb, project.id);
    expect(await verifyToken(admin as unknown as Db, project.id, finalToken)).toBe(true);
    expect(
      await Promise.all(tokens.map((t) => verifyToken(admin as unknown as Db, project.id, t))),
    ).toEqual([false, false, false]);
  });

  // 이슈 #45 — `owner_rw`가 for all 이던 시절에는 로그인 사용자가 공개 키 + 자기 세션으로
  // projects에 직접 INSERT할 수 있었고, 그러면 POST /api/projects가 거는 프로젝트 수 쿼터와
  // projectCreate 레이트리밋이 통째로 우회됐다. 지금은 INSERT 정책 자체가 없다.
  it("projects 직접 INSERT는 요청 스코프 클라이언트로 거부된다 (#45)", async () => {
    const id = `prj_rls${crypto.randomBytes(3).toString("hex")}`;
    // INSERT가 (회귀로) 성공해 버리는 경우에도 뒷정리가 되도록 미리 등록해 둔다.
    projectIds.push(id);
    const now = new Date().toISOString();
    const spec = {
      version: 1,
      id,
      name: "직접 삽입",
      createdAt: now,
      updatedAt: now,
      mockupSource: { type: "snippet", registeredAt: now },
      sceneCodeSeq: 1,
      scenes: [],
      annotations: [],
    };

    // 자기 소유로(owner_id = 본인) 넣는 시도 — 소유권 위조가 아니라 한도 우회가 목적이었다.
    const { error } = await userDb
      .from("projects")
      .insert({ id, owner_id: testUserId, name: spec.name, spec: spec as unknown as Json });

    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501"); // RLS: 해당하는 INSERT 정책이 없다

    // 에러 코드만 보고 넘기지 않는다 — 행이 실제로 생기지 않았는지 관리 클라이언트로 확인.
    const { count } = await admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(count).toBe(0);
  });
});
