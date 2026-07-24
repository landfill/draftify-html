import type { SpecProject } from "@mockspec/shared";
import { getAuthedContext } from "./require-user.js";
import { parseBearerToken } from "./bearer.js";
import { createSupabaseAdminClient } from "../supabase/admin.js";
import { verifyToken } from "../store/tokenStore.js";
import type { Db } from "../store/ids.js";
import { readSpec } from "../store/projectStore.js";

export type ProjectAccess = {
  db: Db;
  projectId: string;
  spec: SpecProject;
  via: "session" | "token";
};

/**
 * 프로젝트 읽기 — 세션(RLS) 또는 경로 D Bearer(해시 검증 후 admin, projectId 한정).
 * open-service는 /api/* 미인증 401이므로 snippet GET도 Bearer 또는 세션 필요.
 */
export async function getProjectReadAccess(
  req: Request,
  projectId: string,
): Promise<ProjectAccess | null> {
  const session = await getAuthedContext();
  if (session) {
    const spec = await readSpec(session.db, projectId);
    if (!spec) return null;
    return { db: session.db, projectId, spec, via: "session" };
  }

  const token = parseBearerToken(req);
  if (!token) return null;
  if (!(await verifyTokenForProject(projectId, token))) return null;

  const admin = createSupabaseAdminClient() as unknown as Db;
  const spec = await readSpec(admin, projectId);
  if (!spec) return null;
  return { db: admin, projectId, spec, via: "token" };
}

/**
 * 저장 계열(PUT·assets·export) — upload는 세션만, snippet은 Bearer만(legacy T20).
 * 토큰 검증은 admin + projectId 스코프 — 타 프로젝트 토큰 우회 불가.
 */
export async function getProjectWriteAccess(
  req: Request,
  projectId: string,
): Promise<ProjectAccess | null> {
  const session = await getAuthedContext();
  const token = parseBearerToken(req);

  if (session) {
    const spec = await readSpec(session.db, projectId);
    if (!spec) return null;
    if (spec.mockupSource.type === "snippet") {
      if (!token || !(await verifyTokenForProject(projectId, token))) return null;
      return {
        db: createSupabaseAdminClient() as unknown as Db,
        projectId,
        spec,
        via: "token",
      };
    }
    return { db: session.db, projectId, spec, via: "session" };
  }

  if (!token) return null;
  if (!(await verifyTokenForProject(projectId, token))) return null;

  const admin = createSupabaseAdminClient() as unknown as Db;
  const spec = await readSpec(admin, projectId);
  if (!spec || spec.mockupSource.type !== "snippet") return null;
  return { db: admin, projectId, spec, via: "token" };
}

async function verifyTokenForProject(projectId: string, token: string): Promise<boolean> {
  const admin = createSupabaseAdminClient() as unknown as Db;
  return verifyToken(admin, projectId, token);
}
