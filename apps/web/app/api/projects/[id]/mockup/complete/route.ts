import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { rateLimit } from "@/lib/abuse/guard.js";
import { userSubject } from "@/lib/abuse/rate-limit.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import {
  ManifestValidationError,
  MockupTooLargeError,
  removeMockupPrefix,
  validateMockupManifest,
} from "@/lib/intake/validate.js";
import type { MockupManifest } from "@/lib/intake/types.js";
import { readSpec } from "@/lib/store/projectStore.js";

/** POST /api/projects/{id}/mockup/complete — manifest 검증만(D5·D6). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const authed = await getAuthedContext();
  if (!authed) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const limited = await rateLimit(userSubject(authed.user.id), "write");
  if (limited) return limited;

  const { id: projectId } = await ctx.params;
  const spec = await readSpec(authed.db, projectId);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${projectId}를 찾을 수 없습니다.`);

  let manifest: MockupManifest;
  try {
    manifest = (await req.json()) as MockupManifest;
  } catch {
    return jsonError("INVALID_REQUEST", "JSON manifest가 필요합니다.");
  }

  try {
    await validateMockupManifest(authed.db, projectId, manifest);
  } catch (err) {
    // 검증 실패 = 목업 미활성화. 부분 업로드를 남기지 않는다(쿼터를 잡아먹지 않게).
    await removeMockupPrefix(authed.db, projectId).catch(() => undefined);
    if (err instanceof MockupTooLargeError) {
      return jsonError("TOO_LARGE", err.message);
    }
    if (err instanceof ManifestValidationError) {
      return jsonError("INVALID_REQUEST", err.message);
    }
    throw err;
  }

  return NextResponse.json({
    ok: true,
    mockupUrl: `/m/${projectId}/`,
    extract: {
      fileCount: manifest.entries.length,
      excluded: manifest.excluded,
      ...(manifest.strippedRoot ? { strippedRoot: manifest.strippedRoot } : {}),
    },
  });
}
