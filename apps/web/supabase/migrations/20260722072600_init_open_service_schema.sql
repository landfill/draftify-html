-- W1 — open-service 초기 스키마 (open-service-kickoff-spec.md §5)
-- 대상: Supabase 프로젝트 draftify-html (ref dhzojuatkmafgwiwtdwe)
--
-- 원칙:
--  - spec(JSONB)이 유일한 진실의 원천. name·updated_at은 트리거가 spec에서 강제하는 파생 투영.
--  - 소유자 격리는 RLS(owner_id = auth.uid()). 하위 테이블은 부모 projects JOIN.
--  - Storage 오브젝트 RLS는 별도(테이블 RLS는 storage.objects를 제약하지 않음).
--  - 프로젝트 생성 시 "Enable automatic RLS" 이벤트 트리거를 켰으므로 public 신규 테이블은
--    RLS가 자동 활성화되지만, 이식성·명시성을 위해 아래에서도 명시적으로 enable 한다(멱등).

-- ─────────────────────────────────────────────────────────────
-- projects — 메타 + spec(JSONB 통짜). SpecProject 직렬화 그대로.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          text primary key,                                   -- "prj_" + nanoid(10) = spec.id (동일 키, 불변)
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,                                      -- 파생 투영(트리거가 spec.name에서 강제)
  spec        jsonb not null,                                     -- 진실의 원천 (mockupSource는 upload|snippet만 — proxy 인테이크 거부)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()                  -- 파생 투영(트리거가 spec.updatedAt에서 강제)
);

alter table public.projects enable row level security;

drop policy if exists "owner_rw" on public.projects;
create policy "owner_rw" on public.projects
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 파생 컬럼을 spec에서 강제 동기화 — 클라이언트가 spec과 불일치하는 name·updated_at을 저장할 수 없다.
create or replace function public.sync_project_derived() returns trigger as $$
begin
  new.name := new.spec->>'name';
  new.updated_at := coalesce((new.spec->>'updatedAt')::timestamptz, now());
  return new;
end $$ language plpgsql;

drop trigger if exists trg_sync_project_derived on public.projects;
create trigger trg_sync_project_derived
  before insert or update on public.projects
  for each row execute function public.sync_project_derived();

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

-- ─────────────────────────────────────────────────────────────
-- project_tokens — 경로 D 저장 인증. 평문 미보관(해시만).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.project_tokens (
  id          text primary key,
  project_id  text not null references public.projects(id) on delete cascade,
  token_hash  text not null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);

alter table public.project_tokens enable row level security;

drop policy if exists "owner_token_rw" on public.project_tokens;
create policy "owner_token_rw" on public.project_tokens
  for all to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_tokens.project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                      where p.id = project_tokens.project_id and p.owner_id = auth.uid()));

create index if not exists project_tokens_project_idx
  on public.project_tokens (project_id);

-- ─────────────────────────────────────────────────────────────
-- project_exports — 산출물 이력 메타 (ExportRecord).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.project_exports (
  id              text primary key,
  project_id      text not null references public.projects(id) on delete cascade,
  created_at      timestamptz not null default now(),
  spec_updated_at timestamptz not null,
  bytes           int not null,
  masked          boolean not null
);

alter table public.project_exports enable row level security;

drop policy if exists "owner_export_rw" on public.project_exports;
create policy "owner_export_rw" on public.project_exports
  for all to authenticated
  using (exists (select 1 from public.projects p
                 where p.id = project_exports.project_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.projects p
                      where p.id = project_exports.project_id and p.owner_id = auth.uid()));

create index if not exists project_exports_project_idx
  on public.project_exports (project_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Storage — 단일 비공개 버킷 "mockups".
--   경로: projects/{projectId}/mockup/**  ·  projects/{projectId}/assets/**
--   테이블 RLS는 storage.objects를 제약하지 않으므로 오브젝트 정책을 별도로 건다.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('mockups', 'mockups', false)
on conflict (id) do nothing;

-- 경로 첫 두 세그먼트 projects/{id}의 소유권을 검증. insert/select/update/delete 전부(for all).
drop policy if exists "owner_storage_all" on storage.objects;
create policy "owner_storage_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'mockups'
    and (storage.foldername(name))[1] = 'projects'
    and exists (select 1 from public.projects p
                where p.id = (storage.foldername(name))[2] and p.owner_id = auth.uid())
  )
  with check (
    bucket_id = 'mockups'
    and (storage.foldername(name))[1] = 'projects'
    and exists (select 1 from public.projects p
                where p.id = (storage.foldername(name))[2] and p.owner_id = auth.uid())
  );
