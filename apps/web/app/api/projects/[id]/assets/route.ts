import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { readSpec, saveAsset } from "@/lib/store/projectStore.js";

const MAX_SNAPSHOT_BYTES = 50 * 1024 * 1024;

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/projects/{id}/assets — 스냅샷 HTML 업로드(field: snapshot). */
export async function POST(req: Request, ctx: RouteCtx) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const { id } = await ctx.params;
  const spec = await readSpec(authed.db, id);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("INVALID_REQUEST", "multipart 본문이 필요합니다.");
  }

  const file = form.get("snapshot");
  if (!(file instanceof File)) {
    return jsonError("INVALID_REQUEST", "스냅샷 파일(field: snapshot)이 필요합니다.");
  }

  if (file.size > MAX_SNAPSHOT_BYTES) {
    return jsonError("TOO_LARGE", "스냅샷이 50MB 제한을 초과했습니다.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const assetKey = await saveAsset(authed.db, id, bytes);
  return NextResponse.json({ assetKey }, { status: 201 });
}
