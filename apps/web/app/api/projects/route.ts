import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/errors.js";
import { createProject } from "@/lib/store/projectStore.js";
import type { Db } from "@/lib/store/ids.js";
import { createSupabaseServerClient } from "@/lib/supabase/server.js";

function parseOwnerLabel(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/** POST /api/projects — 인증된 사용자의 새 프로젝트 행 생성. */
export async function POST(req: Request) {
  const db = (await createSupabaseServerClient()) as unknown as Db;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_REQUEST", "JSON 본문이 필요합니다.");
  }

  const record = body as Record<string, unknown>;
  const originalFilename =
    typeof record.originalFilename === "string" ? record.originalFilename.trim() : "";
  if (!originalFilename) {
    return jsonError("INVALID_REQUEST", "originalFilename이 필요합니다.");
  }

  const name =
    typeof record.name === "string" && record.name.trim()
      ? record.name.trim()
      : originalFilename.replace(/\.zip$/i, "");

  const project = await createProject(
    db,
    name,
    { type: "upload", originalFilename },
    parseOwnerLabel(record.ownerLabel),
  );

  return NextResponse.json({ project }, { status: 201 });
}
