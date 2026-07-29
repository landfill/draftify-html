import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types.js";

/** 브라우저 클라이언트 (공개 키 + 사용자 세션 쿠키). 클라이언트 컴포넌트용. */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
