import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { rateLimit } from "@/lib/abuse/guard.js";
import { userSubject } from "@/lib/abuse/rate-limit.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { readSpec } from "@/lib/store/projectStore.js";
import { issueToken, revokeToken } from "@/lib/store/tokenStore.js";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/projects/{id}/token — 경로 D 토큰 재발급(평문 1회). 소유자 세션만. */
export async function POST(_req: Request, ctx: RouteCtx) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const limited = await rateLimit(userSubject(authed.user.id), "token");
  if (limited) return limited;

  const { id } = await ctx.params;
  const spec = await readSpec(authed.db, id);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);
  if (spec.mockupSource.type !== "snippet") {
    return jsonError("INVALID_REQUEST", "확장(경로 D) 프로젝트만 토큰을 사용합니다.");
  }

  const token = await issueToken(authed.db, id);
  return NextResponse.json({ token }, { status: 201 });
}

/** DELETE /api/projects/{id}/token — 토큰 폐기. */
export async function DELETE(_req: Request, ctx: RouteCtx) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const limited = await rateLimit(userSubject(authed.user.id), "token");
  if (limited) return limited;

  const { id } = await ctx.params;
  const spec = await readSpec(authed.db, id);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);
  if (spec.mockupSource.type !== "snippet") {
    return jsonError("INVALID_REQUEST", "확장(경로 D) 프로젝트만 토큰을 사용합니다.");
  }

  await revokeToken(authed.db, id);
  return new NextResponse(null, { status: 204 });
}
