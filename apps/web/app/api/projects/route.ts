import { NextResponse } from "next/server";
import type { ProjectListItem } from "@mockspec/shared";
import { jsonError } from "@/lib/api/errors.js";
import { rateLimit } from "@/lib/abuse/guard.js";
import { checkProjectCountQuota } from "@/lib/abuse/quota.js";
import { userSubject } from "@/lib/abuse/rate-limit.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { createProject, listProjects } from "@/lib/store/projectStore.js";
import { exportSummary } from "@/lib/store/exportStore.js";
import { issueToken } from "@/lib/store/tokenStore.js";

function parseOwnerLabel(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/** GET /api/projects — 소유자 프로젝트 목록 + export 요약(T29). */
export async function GET() {
  const ctx = await getAuthedContext();
  if (!ctx) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const projects = await listProjects(ctx.db);
  const items: ProjectListItem[] = await Promise.all(
    projects.map(async (p) => ({ ...p, ...(await exportSummary(ctx.db, p.id)) })),
  );
  return NextResponse.json(items);
}

/** POST /api/projects — 인증된 사용자의 새 프로젝트 행 생성. */
export async function POST(req: Request) {
  const ctx = await getAuthedContext();
  if (!ctx) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");
  const { db } = ctx;

  // W8: 생성은 프로젝트 수 쿼터 + 시간당 레이트리밋 둘 다 통과해야 한다.
  const limited = await rateLimit(userSubject(ctx.user.id), "projectCreate");
  if (limited) return limited;

  const quotaMessage = await checkProjectCountQuota(db);
  if (quotaMessage) return jsonError("QUOTA_EXCEEDED", quotaMessage);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("INVALID_REQUEST", "JSON 본문이 필요합니다.");
  }

  const record = body as Record<string, unknown>;

  if (record.source === "snippet") {
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) {
      return jsonError("INVALID_REQUEST", "프로젝트 이름이 필요합니다.");
    }
    const project = await createProject(
      db,
      name,
      { type: "snippet" },
      parseOwnerLabel(record.ownerLabel),
    );
    const token = await issueToken(db, project.id);
    return NextResponse.json({ project, token }, { status: 201 });
  }

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
