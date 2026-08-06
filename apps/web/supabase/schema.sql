-- ═══════════════════════════════════════════════════════════════════════════
-- 정본 스키마 (single source of truth) — 공개판 Supabase 프로젝트 draftify-html
--   ref dhzojuatkmafgwiwtdwe · Postgres 17 · ap-northeast-1
--
-- **이 파일은 "지금 프로덕션 스키마가 무엇인가"의 답이다** (이슈 #57).
-- 마이그레이션(`migrations/`)은 여전히 **적용 수단**이고, 이 파일은 **최종 모습**이다.
-- 둘 중 하나만 고치면 안 된다 — 변경 절차는 AGENTS.md "스키마를 바꿀 때"를 따른다.
--
-- 작성 기준: 2026-08-06, 실 DB를 직접 조회해 검증했다(pg_policies·pg_indexes·pg_proc·
-- pg_trigger·pg_event_trigger·storage.buckets). 마이그레이션 7본을 합성한 결과와도 일치한다.
--
-- ⚠️ 이 파일은 **읽기용 정본이다 — 실행으로 검증하지 않는다** (2026-08-06 사용자 결정).
--    빈 DB에 실행해 같은 스키마가 나오는지는 확인하지 않았고 확인할 계획도 없다:
--    Supabase 환경이 하나뿐이고(Preview·Production 공용) **개발용 분리 계획도 없어서**
--    "새 환경에 스키마를 세운다"는 상황 자체가 오지 않는다.
--    실제로 세워야 하는 일이 생기면 `migrations/`를 쓴다 — 실 DB에 적용돼 증명된 경로다.
--
-- 담기지 않는 것 (의도):
--   - Supabase가 관리하는 auth·storage 스키마의 기본 구조 (플랫폼이 만든다)
--   - 프로젝트 옵션 "Enable automatic RLS"가 만든 `public.rls_auto_enable()`과
--     `ensure_rls` 이벤트 트리거 — 대시보드 설정 산물이라 SQL로 재현하지 않는다.
--     아래 스키마는 그것에 의존하지 않는다 (모든 테이블에 명시적으로 RLS를 켠다).
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. projects — 메타 + spec(JSONB 통짜)
--
-- spec(JSONB)이 유일한 진실의 원천. name·updated_at은 트리거가 spec에서 강제하는 파생 투영이다
-- (킥오프 open-service §5). RLS만으로는 소유자가 파생 컬럼을 spec과 다르게 갱신하는 것을 못 막는다.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          text primary key,                                   -- "prj_" + nanoid(10) = spec.id (동일 키, 불변)
  owner_id    uuid not null default auth.uid()
                references auth.users(id) on delete cascade,      -- default: 요청 스코프 클라이언트가 owner를 위조할 수 없게 한다
  name        text not null,                                      -- 파생 투영 (트리거가 spec.name에서 강제)
  spec        jsonb not null,                                     -- 진실의 원천 (mockupSource는 upload|snippet만 — proxy 인테이크 거부)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()                  -- 파생 투영 (트리거가 spec.updatedAt에서 강제)
);

alter table public.projects enable row level security;

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

-- 파생 컬럼 강제 동기화. search_path는 ''로 고정한다 — 가변이면 하이재킹 표면이 된다
-- (security advisor 대응). pg_catalog는 빈 search_path에서도 암묵 검색되므로 now()·캐스트는 정상.
create or replace function public.sync_project_derived() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.name := new.spec->>'name';
  new.updated_at := coalesce((new.spec->>'updatedAt')::timestamptz, now());
  return new;
end $$;

drop trigger if exists trg_sync_project_derived on public.projects;
create trigger trg_sync_project_derived
  before insert or update on public.projects
  for each row execute function public.sync_project_derived();

-- RLS: select/update/delete만 둔다. **INSERT 정책은 의도적으로 없다** (이슈 #45 A안).
-- 정책이 없으면 authenticated의 INSERT는 전부 거부되고 생성은 service_role(서버 라우트)만
-- 할 수 있다 — 소유권은 RLS로 표현되지만 **수량·빈도(쿼터·레이트리밋)는 RLS로 표현되지 않는다.**
drop policy if exists "owner_rw" on public.projects;   -- 구 통합 정책 (init) — 위 이유로 제거됐다

drop policy if exists "owner_select" on public.projects;
create policy "owner_select" on public.projects
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "owner_update" on public.projects;
create policy "owner_update" on public.projects
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "owner_delete" on public.projects;
create policy "owner_delete" on public.projects
  for delete to authenticated
  using (owner_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- 2. project_tokens — 경로 D 저장 인증. 평문 미보관(해시만).
--
-- project_id UNIQUE가 핵심이다 (이슈 #47): 재발급이 delete → insert 2단계라 동시 요청이
-- 겹치면 행이 2개 남고, verifyToken()의 maybeSingle()이 에러를 내 **해당 프로젝트가 인증
-- 불능으로 잠긴다.** 동시에 tokenStore의 upsert({ onConflict: "project_id" })가 추론할
-- 충돌 대상이기도 하다 — 이 제약이 없으면 PostgREST가 요청 자체를 거부한다.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.project_tokens (
  id          text primary key,
  project_id  text not null references public.projects(id) on delete cascade,
  token_hash  text not null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  constraint project_tokens_project_id_key unique (project_id)
);

alter table public.project_tokens enable row level security;

-- UNIQUE가 만드는 인덱스가 project_id 조회를 그대로 커버한다 → 별도 인덱스를 두지 않는다.
-- (init의 project_tokens_project_idx는 #47에서 중복으로 제거됐다.)

drop policy if exists "owner_token_rw" on public.project_tokens;
create policy "owner_token_rw" on public.project_tokens
  for all to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_tokens.project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                      where p.id = project_tokens.project_id and p.owner_id = auth.uid()));


-- ───────────────────────────────────────────────────────────────────────────
-- 3. project_exports — 산출물 이력 메타 (ExportRecord)
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.project_exports (
  id              text primary key,
  project_id      text not null references public.projects(id) on delete cascade,
  created_at      timestamptz not null default now(),
  spec_updated_at timestamptz not null,
  bytes           int not null,
  masked          boolean not null
);

alter table public.project_exports enable row level security;

create index if not exists project_exports_project_idx
  on public.project_exports (project_id, created_at desc);

drop policy if exists "owner_export_rw" on public.project_exports;
create policy "owner_export_rw" on public.project_exports
  for all to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_exports.project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                      where p.id = project_exports.project_id and p.owner_id = auth.uid()));


-- ───────────────────────────────────────────────────────────────────────────
-- 4. rate_limit_counters — 남용 방어 레이트리밋 (킥오프 open-service §7.5)
--
-- 서버리스(Vercel)는 요청마다 인스턴스가 갈릴 수 있어 in-memory 카운터가 무의미하다.
-- 고정 윈도우: window_start = floor(epoch / window_seconds) * window_seconds.
--
-- **RLS 활성 + 정책 없음**이 의도다 — authenticated는 select/insert/update/delete 전부 불가.
-- 접근은 service_role과 아래 SECURITY DEFINER 함수뿐이다.
-- ───────────────────────────────────────────────────────────────────────────
create table if not exists public.rate_limit_counters (
  subject      text        not null,   -- "usr:{auth.uid}" 또는 "prj:{projectId}"(경로 D Bearer)
  bucket       text        not null,   -- limits.ts의 RATE_LIMITS 키
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (subject, bucket, window_start)
);

alter table public.rate_limit_counters enable row level security;
-- 정책을 의도적으로 만들지 않는다.
-- security advisor 0008(RLS Enabled No Policy)이 INFO로 잡지만 **의도된 상태다** — 수용하고 둔다.

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

-- 카운터 1 증가 후 허용 여부 반환. allowed=false면 호출자가 429 + Retry-After로 거부한다.
-- 한도 값은 호출자(limits.ts)가 넘긴다 — 값의 단일 소스를 코드에 두기 위함.
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


-- ───────────────────────────────────────────────────────────────────────────
-- 5. Storage — 단일 비공개 버킷 "mockups"
--
-- 경로: projects/{projectId}/mockup/**  ·  projects/{projectId}/assets/**
-- Postgres 테이블 RLS는 storage.objects를 제약하지 않으므로 오브젝트 정책을 별도로 건다.
--
-- ⚠️ 소유권 검증은 반드시 **SECURITY DEFINER 함수로 분리**한다. 정책 본문에 projects EXISTS를
--    직접 쓰면 storage 컨텍스트에서 기대대로 평가되지 않아 업로드가 전부
--    "new row violates row-level security policy"로 거부된다 (W2에서 실제로 겪었다).
-- ───────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', false)
on conflict (id) do nothing;

create or replace function public.storage_object_owned_by_user(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = split_part(object_name, '/', 2)
      and p.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.storage_object_owned_by_user(text) from public;
grant execute on function public.storage_object_owned_by_user(text) to authenticated;

-- ⚠️ 의도 ≠ 실제 (2026-08-06 실측, 이슈 #57 조사에서 발견).
--    위 두 줄의 의도는 "authenticated만 실행 가능"이었지만, 실제 ACL은
--    `postgres=X | anon=X | authenticated=X | service_role=X`로 **anon·service_role도 갖고 있다.**
--    원인: Supabase의 default privileges가 public 스키마 신규 함수에 세 역할 EXECUTE를
--    **명시적으로** 부여하는데, `revoke ... from public`은 PUBLIC 의사역할만 지우고
--    명시적 역할 grant는 지우지 않는다.
--    → security advisor 0028(anon이 SECURITY DEFINER 함수 실행 가능)이 지금 WARN 상태다.
--    영향: anon 컨텍스트에서는 auth.uid()가 null이라 항상 false를 반환하므로 정보 노출은
--    사실상 없다. 다만 **의도대로면 anon은 호출 자체가 불가해야 한다.**
--    조치는 이슈 #105로 분리했다 — 프로덕션 권한 변경이라 이 작업(정본 문서화)의 범위 밖이다.
--    적용할 때 필요한 문장: revoke execute on function public.storage_object_owned_by_user(text) from anon;

drop policy if exists "owner_storage_all" on storage.objects;  -- 구 통합 정책 (init) — 위 이유로 교체됐다

drop policy if exists "owner_storage_insert" on storage.objects;
create policy "owner_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );

drop policy if exists "owner_storage_select" on storage.objects;
create policy "owner_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );

drop policy if exists "owner_storage_update" on storage.objects;
create policy "owner_storage_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  )
  with check (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );

drop policy if exists "owner_storage_delete" on storage.objects;
create policy "owner_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );


-- ───────────────────────────────────────────────────────────────────────────
-- 6. 하드닝 — security advisor 대응 (전체가 위 정의에 이미 반영돼 있다)
--
--  - sync_project_derived·storage_object_owned_by_user: search_path 고정 ''
--  - consume_rate_limit: search_path = public 고정 + service_role만 EXECUTE
--  - rls_auto_enable(): "Enable automatic RLS" 옵션이 만든 SECURITY DEFINER 이벤트-트리거
--    헬퍼. public 스키마라 PostgREST가 /rest/v1/rpc/로 노출하고 anon·authenticated가 호출
--    가능하다(advisor 0028·0029). 이벤트 트리거 발화는 grant와 무관하므로 회수해도 자동
--    RLS는 계속 동작한다. **함수 존재 시에만** 회수한다 — 대시보드 옵션 산물이라
--    새 환경에는 없을 수 있다.
-- ───────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
  end if;
end $$;
