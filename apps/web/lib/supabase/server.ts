import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types.js";

/**
 * 요청 스코프 Supabase 클라이언트 (사용자 세션 JWT 동반).
 * 이 클라이언트로 하는 모든 DB·Storage 접근은 RLS가 owner_id = auth.uid() 로 격리한다.
 * Route Handler·Server Component·Server Action에서 사용.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component에서 호출되면 set이 불가 — 미들웨어가 세션 갱신을 담당(W7).
          }
        },
      },
    },
  );
}
