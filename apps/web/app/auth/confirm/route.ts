import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server.js";

/**
 * 이메일 링크 확인 — `token_hash`를 서버에서 검증해 세션 쿠키를 심는다.
 *
 * `/auth/callback`(코드 교환)과의 차이: 그쪽은 **링크를 요청한 브라우저**에 PKCE code_verifier가
 * 있어야 성립한다. 노트북에서 매직링크를 요청하고 휴대폰에서 열면 verifier가 없어 실패한다.
 * 이 경로는 verifier 없이 `verifyOtp`로 검증하므로 그 케이스를 덮는다(Supabase 권장 패턴).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const url = new URL("/login", origin);
  url.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(url);
}
