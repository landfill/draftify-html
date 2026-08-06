-- W2 준비 — projects.owner_id 기본값을 auth.uid()로.
--   요청 스코프 Supabase 클라이언트(사용자 JWT)로 insert하면 owner_id가 자동으로
--   현재 사용자로 채워진다. RLS with check (owner_id = auth.uid())가 여전히 검증하므로
--   어댑터는 owner_id를 명시하지 않아도 되고, 남의 소유로 위조할 수도 없다.
--   (service_role 등 auth.uid()가 null인 컨텍스트에서 insert하면 not-null 위반 — 의도된 안전장치.)
alter table public.projects alter column owner_id set default auth.uid();
