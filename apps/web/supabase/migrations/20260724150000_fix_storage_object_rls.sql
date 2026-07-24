-- Storage objects RLS — projects 소유권 검증을 SECURITY DEFINER로 분리.
-- 증상: authenticated 사용자가 Postgres projects RLS는 통과하지만 Storage upload가
-- "new row violates row-level security policy"로 거부됨(정책 내 projects EXISTS가
-- storage 컨텍스트에서 기대대로 평가되지 않음). split_part + definer 함수로 고정.

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

drop policy if exists "owner_storage_all" on storage.objects;
drop policy if exists "owner_storage_insert" on storage.objects;
drop policy if exists "owner_storage_select" on storage.objects;
drop policy if exists "owner_storage_update" on storage.objects;
drop policy if exists "owner_storage_delete" on storage.objects;

create policy "owner_storage_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );

create policy "owner_storage_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );

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

create policy "owner_storage_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'mockups'
    and split_part(name, '/', 1) = 'projects'
    and public.storage_object_owned_by_user(name)
  );
