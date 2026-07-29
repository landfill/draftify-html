import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { accessSubject, rateLimit } from "@/lib/abuse/guard.js";
import { LIMITS, formatMb } from "@/lib/abuse/limits.js";
import { checkAssetSizeQuota } from "@/lib/abuse/quota.js";
import { getProjectWriteAccess } from "@/lib/auth/project-access.js";
import { saveAsset } from "@/lib/store/projectStore.js";

type RouteCtx = { params: Promise<{ id: string }> };

/** POST /api/projects/{id}/assets — 스냅샷 HTML 업로드(field: snapshot). */
export async function POST(req: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const access = await getProjectWriteAccess(req, id);
  if (!access) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const limited = await rateLimit(accessSubject(access), "write");
  if (limited) return limited;

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

  if (file.size > LIMITS.snapshotMaxBytes) {
    return jsonError(
      "TOO_LARGE",
      `스냅샷이 ${formatMb(LIMITS.snapshotMaxBytes)} 제한을 초과했습니다.`,
    );
  }

  // W8: 1건 상한만으로는 화면을 계속 추가하는 누적을 못 막는다 → 프로젝트당 총량도 본다.
  const quotaMessage = await checkAssetSizeQuota(access.db, id, file.size);
  if (quotaMessage) return jsonError("QUOTA_EXCEEDED", quotaMessage);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const assetKey = await saveAsset(access.db, id, bytes);
  return NextResponse.json({ assetKey }, { status: 201 });
}
