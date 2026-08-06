-- W1 하드닝 — 초기 스키마 적용 후 security advisor WARN 3건 처리.
--
--  1) sync_project_derived: search_path 가변 → 고정('')로 하이재킹 표면 제거.
--     (pg_catalog는 빈 search_path에서도 암묵적으로 먼저 검색되므로 now()·연산자·캐스트는 정상.)
--  2) rls_auto_enable(): 프로젝트 생성 시 "Enable automatic RLS" 옵션이 만든 SECURITY DEFINER
--     이벤트-트리거 헬퍼. public 스키마라 PostgREST가 /rest/v1/rpc/rls_auto_enable 로 노출하고
--     anon·authenticated가 호출 가능(advisor 0028·0029). DDL 이벤트에서만 쓰이면 되므로 API
--     EXECUTE 권한을 회수한다 — 이벤트 트리거 발화는 grant와 무관하므로 자동 RLS 동작은 유지된다.

-- 1) 파생 컬럼 트리거 함수 search_path 고정
create or replace function public.sync_project_derived() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.name := new.spec->>'name';
  new.updated_at := coalesce((new.spec->>'updatedAt')::timestamptz, now());
  return new;
end $$;

-- 2) 자동 RLS 헬퍼의 API 노출 차단 (함수 존재 시에만)
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
