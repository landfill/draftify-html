import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { accessSubject, rateLimit } from "@/lib/abuse/guard.js";
import { validatePutSpec } from "@/lib/api/validate-spec.js";
import { applySnippetPutOverrides } from "@/lib/api/snippet-put-overrides.js";
import {
  getProjectReadAccess,
  getProjectWriteAccess,
} from "@/lib/auth/project-access.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { readSpec, replaceSpec, deleteProject } from "@/lib/store/projectStore.js";

type RouteCtx = { params: Promise<{ id: string }> };

/** GET /api/projects/{id} — spec.json 전체. 세션 또는 경로 D Bearer. */
export async function GET(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const access = await getProjectReadAccess(req, id);
  if (!access) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  return NextResponse.json(access.spec);
}

/** PUT /api/projects/{id} — spec 전체 교체 + orphan asset GC. upload=세션, snippet=Bearer. */
export async function PUT(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const access = await getProjectWriteAccess(req, id);
  if (!access) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const limited = await rateLimit(accessSubject(access), "write");
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_REQUEST", "JSON 본문이 필요합니다.");
  }

  const validated = validatePutSpec(body, id, access.spec);
  if (!validated.ok) return jsonError("INVALID_REQUEST", validated.message);

  const spec = applySnippetPutOverrides(access.spec, validated.spec, req);
  const saved = await replaceSpec(access.db, access.spec, spec);
  return NextResponse.json(saved);
}

/** DELETE /api/projects/{id} — 프로젝트·Storage·하위 행 삭제. */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const { id } = await ctx.params;
  const spec = await readSpec(authed.db, id);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);

  await deleteProject(authed.db, id);
  return NextResponse.json({ ok: true });
}
