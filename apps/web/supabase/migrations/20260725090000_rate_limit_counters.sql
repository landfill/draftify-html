-- W8 — 남용 방어: 레이트리밋 카운터 (킥오프 §7.5 / technical-spec §7.4)
--
-- 원칙:
--  - 서버리스(Vercel)는 요청마다 인스턴스가 갈릴 수 있어 in-memory 카운터가 무의미하다.
--    카운터는 Postgres에 두고, 증가·판정을 한 문장(원자적)으로 처리한다.
--  - 고정 윈도우: window_start = floor(epoch / window_seconds) * window_seconds.
--    슬라이딩 윈도우보다 단순하고(행 1개) 남용 차단 목적에는 충분하다.
--  - 이 테이블은 사용자가 만지면 안 된다 → RLS 활성 + **정책 없음**(authenticated 전면 차단).
--    접근은 service_role(admin 클라이언트)과 SECURITY DEFINER 함수뿐.

create table if not exists public.rate_limit_counters (
  subject      text        not null,   -- "usr:{auth.uid}" 또는 "prj:{projectId}"(경로 D Bearer)
  bucket       text        not null,   -- limits.ts의 RATE_LIMITS 키
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (subject, bucket, window_start)
);

alter table public.rate_limit_counters enable row level security;
-- 정책을 의도적으로 만들지 않는다 (authenticated는 select/insert/update/delete 전부 불가).

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

-- ─────────────────────────────────────────────────────────────
-- consume_rate_limit — 카운터 1 증가 후 허용 여부 반환.
--   allowed=false 이면 호출자는 429 + Retry-After(retry_after_seconds)로 거부한다.
--   한도는 호출자(limits.ts)가 넘긴다 — 값의 단일 소스를 코드에 두기 위함.
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_rate_limit(
  p_subject        text,
  p_bucket         text,
  p_limit          int,
  p_window_seconds int
)
returns table (allowed boolean, remaining int, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        int;
begin
  if p_limit <= 0 or p_window_seconds <= 0 then
    raise exception 'invalid rate limit args: limit=%, window=%', p_limit, p_window_seconds;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (subject, bucket, window_start, count)
  values (p_subject, p_bucket, v_window_start, 1)
  on conflict (subject, bucket, window_start)
    do update set count = public.rate_limit_counters.count + 1
  returning public.rate_limit_counters.count into v_count;

  -- 지난 윈도우 행 청소. 매 호출 정리는 낭비이므로 확률적으로만(별도 크론 없이 유지보수 0).
  if random() < 0.01 then
    delete from public.rate_limit_counters
      where window_start < now() - interval '1 day';
  end if;

  return query select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::int,
      1
    );
end $$;

revoke all on function public.consume_rate_limit(text, text, int, int) from public;
revoke all on function public.consume_rate_limit(text, text, int, int) from anon;
revoke all on function public.consume_rate_limit(text, text, int, int) from authenticated;
grant execute on function public.consume_rate_limit(text, text, int, int) to service_role;
