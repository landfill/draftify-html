import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { readSpec, deleteProject } from "@/lib/store/projectStore.js";

/** DELETE /api/projects/{id} — 프로젝트·Storage·하위 행 삭제. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const { id } = await ctx.params;
  const spec = await readSpec(authed.db, id);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);

  await deleteProject(authed.db, id);
  return NextResponse.json({ ok: true });
}
