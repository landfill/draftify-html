import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { readAsset } from "@/lib/store/projectStore.js";

type RouteCtx = { params: Promise<{ id: string; key: string }> };

/** GET /api/projects/{id}/assets/{key} — 스냅샷 HTML. */
export async function GET(_req: Request, ctx: RouteCtx) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const { id, key } = await ctx.params;
  const data = await readAsset(authed.db, id, key);
  if (!data) return jsonError("NOT_FOUND", "asset을 찾을 수 없습니다.");

  return new NextResponse(Buffer.from(data), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
