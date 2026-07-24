import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import {
  ManifestValidationError,
  removeMockupPrefix,
  validateMockupManifest,
} from "@/lib/intake/validate.js";
import type { MockupManifest } from "@/lib/intake/types.js";
import { readSpec } from "@/lib/store/projectStore.js";
import type { Db } from "@/lib/store/ids.js";
import { createSupabaseServerClient } from "@/lib/supabase/server.js";

/** POST /api/projects/{id}/mockup/complete — manifest 검증만(D5·D6). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const db = (await createSupabaseServerClient()) as unknown as Db;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const spec = await readSpec(db, projectId);
  if (!spec) return jsonError("NOT_FOUND", `프로젝트 ${projectId}를 찾을 수 없습니다.`);

  let manifest: MockupManifest;
  try {
    manifest = (await req.json()) as MockupManifest;
  } catch {
    return jsonError("INVALID_REQUEST", "JSON manifest가 필요합니다.");
  }

  try {
    await validateMockupManifest(db, projectId, manifest);
  } catch (err) {
    await removeMockupPrefix(db, projectId).catch(() => undefined);
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
