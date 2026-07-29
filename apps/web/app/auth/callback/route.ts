import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next.js";
import { createSupabaseServerClient } from "@/lib/supabase/server.js";

/** Supabase Auth OAuth·매직링크 콜백 — code → 세션 쿠키. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", "auth_callback_failed");
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(new URL(next, origin));
}
