import type { NextResponse } from "next/server";
import { rateLimitedError } from "../api/errors.js";
import type { ProjectAccess } from "../auth/project-access.js";
import { consumeRateLimit, projectSubject, userSubject } from "./rate-limit.js";
import type { RateBucket } from "./limits.js";

/**
 * 라우트에서 한 줄로 쓰는 레이트리밋 게이트 — 거부 응답을 돌려주거나(즉시 return) null.
 *
 *   const limited = await rateLimit(userSubject(user.id), "projectCreate");
 *   if (limited) return limited;
 */
export async function rateLimit(
  subject: string,
  bucket: RateBucket,
): Promise<NextResponse | null> {
  const verdict = await consumeRateLimit(subject, bucket);
  return verdict.allowed ? null : rateLimitedError(verdict.retryAfterSeconds);
}

/**
 * 저장 계열(PUT·assets·export·complete)의 주체 — 세션이면 사용자, 경로 D Bearer면 프로젝트.
 * 경로 D는 Supabase 사용자가 없으므로 프로젝트를 주체로 삼는다(킥오프 §7.5).
 */
export function accessSubject(access: Pick<ProjectAccess, "projectId" | "userId">): string {
  return access.userId ? userSubject(access.userId) : projectSubject(access.projectId);
}
