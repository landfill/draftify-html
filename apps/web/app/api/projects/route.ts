import { NextResponse } from "next/server";
import type { ProjectListItem } from "@mockspec/shared";
import { jsonError } from "@/lib/api/errors.js";
import { rateLimit } from "@/lib/abuse/guard.js";
import { checkProjectCountQuota } from "@/lib/abuse/quota.js";
import { userSubject } from "@/lib/abuse/rate-limit.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin.js";
import type { Db } from "@/lib/store/ids.js";
import { createProject } from "@/lib/store/projectStore.js";
import { listProjectsForConsole } from "@/lib/store/projectList.js";
import { issueToken } from "@/lib/store/tokenStore.js";

function parseOwnerLabel(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed || undefined;
}

/**
 * GET /api/projects — 소유자 프로젝트 목록 + export 요약(T29).
 *
 * 첫 화면은 이 라우트를 부르지 않는다 — `app/page.tsx`가 서버에서 미리 실어 보낸다(#81).
 * 여기는 **갱신 경로**다: 업로드·삭제·토큰 발급 뒤 `loadProjects()`가 부른다.
 */
export async function GET() {
  const ctx = await getAuthedContext();
  if (!ctx) return jsonError("UNAUTHORIZED", "로그인이 필요합니다.");

  const items: ProjectListItem[] = await listProjectsForConsole(ctx.db);
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

  // 쿼터는 요청 스코프로 센다 — RLS SELECT가 본인 프로젝트만 보여주므로 count가 곧 보유 수다.
  const quotaMessage = await checkProjectCountQuota(db);
  if (quotaMessage) return jsonError("QUOTA_EXCEEDED", quotaMessage);

  // 생성만 관리 클라이언트로 — projects에 INSERT 정책이 없다(#45). 위 두 게이트를 통과한
  // 이 지점이 프로젝트가 만들어질 수 있는 유일한 곳이다.
  const admin = createSupabaseAdminClient() as unknown as Db;

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
      admin,
      ctx.user.id,
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
    admin,
    ctx.user.id,
    name,
    { type: "upload", originalFilename },
    parseOwnerLabel(record.ownerLabel),
  );

  return NextResponse.json({ project }, { status: 201 });
}
