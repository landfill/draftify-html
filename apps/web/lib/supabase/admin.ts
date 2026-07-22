import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

/**
 * 서버 전용 관리 클라이언트 (service_role — RLS 우회).
 *
 * 사용자 세션이 없는 경로에서만 쓴다. 대표 케이스: 경로 D 저장(W6) — 요청이 프로젝트
 * Bearer 토큰으로만 인증되고 Supabase 사용자 JWT가 없으므로, 토큰을 서버가 직접 검증한 뒤
 * 해당 프로젝트에 한해 service_role로 저장한다. 절대 브라우저로 내보내지 않는다.
 *
 * SUPABASE_SERVICE_ROLE_KEY 가 없으면 명시적으로 실패시킨다 — 조용히 익명 키로
 * 폴백해 권한이 부족한 채 도는 것을 막는다.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 미설정 — 서버 관리 클라이언트를 만들 수 없다 (.env.local 확인).",
    );
  }
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
