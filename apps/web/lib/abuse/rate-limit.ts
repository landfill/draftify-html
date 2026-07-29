import { createSupabaseAdminClient } from "../supabase/admin.js";
import { RATE_LIMITS, type RateBucket } from "./limits.js";

/**
 * 레이트리밋 — Postgres 고정 윈도우 카운터(마이그레이션 20260725090000).
 * in-memory 카운터를 쓰지 않는 이유는 technical-spec §7.4: 서버리스는 인스턴스가 갈린다.
 */

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/** 세션 사용자 주체. */
export const userSubject = (userId: string): string => `usr:${userId}`;
/** 경로 D(Bearer 전용, 세션 없음) 주체 — 프로젝트 단위. */
export const projectSubject = (projectId: string): string => `prj:${projectId}`;

/**
 * 카운터를 1 증가시키고 허용 여부를 돌려준다.
 *
 * 카운터 인프라 자체가 고장 났을 때(DB 접근 불가 등)는 **열어 준다(fail-open)** — 레이트리밋은
 * 남용 억제 장치이고, 여기서 닫으면 정상 사용자의 편집·저장이 전면 중단된다. 인증·소유권 같은
 * 실제 보안 경계는 이 함수와 무관하게 RLS·토큰이 강제한다.
 */
export async function consumeRateLimit(
  subject: string,
  bucket: RateBucket,
): Promise<RateLimitVerdict> {
  const rule = RATE_LIMITS[bucket];
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_subject: subject,
      p_bucket: bucket,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("consume_rate_limit returned no row");

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      retryAfterSeconds: row.retry_after_seconds,
    };
  } catch (err) {
    console.error("[rate-limit] fail-open:", err instanceof Error ? err.message : err);
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}
