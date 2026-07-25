import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../supabase/admin.js";
import type { Database } from "../supabase/database.types.js";
import { hasSupabaseIntegrationEnv, loadWebEnvLocal } from "../test/load-env.js";
import { consumeRateLimit, projectSubject, userSubject } from "./rate-limit.js";
import { RATE_LIMITS } from "./limits.js";

loadWebEnvLocal();
const RUN = hasSupabaseIntegrationEnv();

/**
 * 실 Supabase에 붙어 consume_rate_limit()의 원자성·한도·격리를 본다(W8).
 * env(.env.local)가 없으면 스킵 — CI는 유닛만 돌린다.
 */
describe.runIf(RUN)("consume_rate_limit (integration)", () => {
  const admin = RUN ? createSupabaseAdminClient() : null;
  const subject = `test:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  async function cleanup(prefix: string) {
    await admin!.from("rate_limit_counters").delete().like("subject", `${prefix}%`);
  }

  beforeAll(() => cleanup("test:"));
  afterAll(() => cleanup("test:"));

  it("한도까지 허용하고 그 다음을 거부한다", async () => {
    const limit = 3;
    const results = [];
    for (let i = 0; i < limit + 2; i++) {
      const { data, error } = await admin!.rpc("consume_rate_limit", {
        p_subject: subject,
        p_bucket: "unit",
        p_limit: limit,
        p_window_seconds: 3600,
      });
      expect(error).toBeNull();
      results.push(data![0]!);
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
    expect(results[0]!.remaining).toBe(2);
    expect(results[2]!.remaining).toBe(0);
    // 거부 응답은 재시도 시각을 알려준다 (Retry-After 헤더로 나간다).
    expect(results[3]!.retry_after_seconds).toBeGreaterThan(0);
    expect(results[3]!.retry_after_seconds).toBeLessThanOrEqual(3600);
  });

  it("동시 호출에서도 카운트가 유실되지 않는다 (원자적 증가)", async () => {
    const parallelSubject = `${subject}:par`;
    const calls = 10;
    const verdicts = await Promise.all(
      Array.from({ length: calls }, () =>
        admin!.rpc("consume_rate_limit", {
          p_subject: parallelSubject,
          p_bucket: "unit",
          p_limit: 4,
          p_window_seconds: 3600,
        }),
      ),
    );
    const allowed = verdicts.filter((v) => v.data![0]!.allowed).length;
    expect(allowed).toBe(4);

    const { data: rows } = await admin!
      .from("rate_limit_counters")
      .select("count")
      .eq("subject", parallelSubject);
    expect(rows).toHaveLength(1);
    expect(rows![0]!.count).toBe(calls);
  });

  it("주체·버킷·윈도우 길이가 서로를 오염시키지 않는다", async () => {
    const a = await consumeRateLimit(userSubject(`u-${subject}`), "write");
    const b = await consumeRateLimit(projectSubject(`p-${subject}`), "write");
    expect(a.remaining).toBe(RATE_LIMITS.write.limit - 1);
    expect(b.remaining).toBe(RATE_LIMITS.write.limit - 1);

    await admin!.from("rate_limit_counters").delete().like("subject", `usr:u-test:%`);
    await admin!.from("rate_limit_counters").delete().like("subject", `prj:p-test:%`);
  });

  it("authenticated(공개 키)는 카운터를 읽거나 함수를 호출할 수 없다", async () => {
    const anon = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );

    const { data: rows } = await anon.from("rate_limit_counters").select("*");
    expect(rows ?? []).toEqual([]); // RLS 정책 없음 → 빈 결과

    const { error } = await anon.rpc("consume_rate_limit", {
      p_subject: subject,
      p_bucket: "unit",
      p_limit: 1,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull(); // EXECUTE 권한 없음
  });

  it("잘못된 인자는 예외 — 조용히 통과시키지 않는다", async () => {
    const { error } = await admin!.rpc("consume_rate_limit", {
      p_subject: subject,
      p_bucket: "unit",
      p_limit: 0,
      p_window_seconds: 60,
    });
    expect(error).not.toBeNull();
  });
});
