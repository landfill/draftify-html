import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server.js";
import type { Db } from "@/lib/store/ids.js";

export type AuthedContext = { db: Db; user: User };

/** Route Handler용 — 세션 없으면 null. */
export async function getAuthedContext(): Promise<AuthedContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { db: supabase as unknown as Db, user };
}
