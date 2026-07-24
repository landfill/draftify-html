import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import {
  EXPORT_INLINE_MAX_BYTES,
  EXPORT_SIZE_WARNING_BYTES,
  asciiHeaderFilename,
  assembleExportHtml,
  downloadFilename,
  exportObjectPath,
} from "@/lib/export/build-export.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { appendExportRecord } from "@/lib/store/exportStore.js";
import { readSpec } from "@/lib/store/projectStore.js";
import { STORAGE_BUCKET } from "@/lib/store/ids.js";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/{id}/export — 산출물 HTML.
 * 작은 본문은 인라인, 큰 본문은 Storage signed URL로 302(킥오프 §6 ⓐ — SDK가 redirect 따라 HTML 저장).
 */
export async function POST(_req: Request, ctx: RouteCtx) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const { id } = await ctx.params;
  const project = await readSpec(authed.db, id);
  if (!project) return jsonError("NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);

  const { html, usedMasked } = await assembleExportHtml(authed.db, project);
  const bytes = Buffer.byteLength(html, "utf8");

  const record = await appendExportRecord(authed.db, id, {
    specUpdatedAt: project.updatedAt,
    bytes,
    masked: usedMasked,
  }).catch(() => null);

  const filename = downloadFilename(project.name);
  const disposition = `attachment; filename="${asciiHeaderFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

  if (bytes > EXPORT_INLINE_MAX_BYTES) {
    const objectPath = exportObjectPath(id, record?.id ?? `exp_fallback`);
    const { error: uploadError } = await authed.db.storage
      .from(STORAGE_BUCKET)
      .upload(objectPath, html, {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });
    if (uploadError) return jsonError("INTERNAL", "산출물 저장에 실패했습니다.");

    const { data: signed, error: signError } = await authed.db.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(objectPath, 120);
    if (signError || !signed?.signedUrl) {
      return jsonError("INTERNAL", "산출물 다운로드 URL 생성에 실패했습니다.");
    }

    const headers = new Headers({ Location: signed.signedUrl });
    if (bytes > EXPORT_SIZE_WARNING_BYTES) headers.set("X-Mockspec-Warning", "EXPORT_TOO_LARGE");
    return new NextResponse(null, { status: 302, headers });
  }

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Disposition": disposition,
  };
  if (bytes > EXPORT_SIZE_WARNING_BYTES) headers["X-Mockspec-Warning"] = "EXPORT_TOO_LARGE";

  return new NextResponse(html, { status: 200, headers });
}
