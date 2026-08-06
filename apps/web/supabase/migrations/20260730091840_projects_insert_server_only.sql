-- ─────────────────────────────────────────────────────────────
-- projects INSERT를 서버 전용으로 (이슈 #45 — A안)
--
-- `owner_rw`가 `for all`이라 로그인 사용자가 공개 키 + 자기 세션으로 `projects`에 직접
-- INSERT할 수 있었다. 그러면 `POST /api/projects`가 거는 두 게이트를 통째로 건너뛴다:
--   - checkProjectCountQuota (사용자당 프로젝트 20개 — 킥오프 §7.5 / technical-spec §7.4)
--   - projectCreate 레이트리밋
-- 소유권은 RLS로 표현되지만 **수량·빈도는 RLS로 표현되지 않는다**는 것이 이 이슈의 본질이다.
--
-- 조치: `for all` 정책을 select/update/delete로 쪼개고 **INSERT 정책은 만들지 않는다.**
-- 해당 정책이 없으면 authenticated의 INSERT는 전부 거부되고, 생성은 service_role
-- (= 서버 라우트)만 할 수 있다. 정상 클라이언트는 이미 API를 쓰므로 화면 동작은 그대로다.
--
-- ⚠️ 적용 순서: 이 마이그레이션은 코드 배포보다 **나중**이다. 배포된 구 코드는 요청 스코프
-- 클라이언트로 INSERT하므로, 먼저 적용하면 그 시점부터 프로젝트 생성이 실패한다.
-- (#47은 반대였다 — 그쪽은 코드가 제약에 의존해서 마이그레이션이 먼저였다. 순서는
--  일률적이지 않고, "무엇이 무엇에 의존하는가"로 정한다.)
--
-- `owner_id`의 default `auth.uid()`는 그대로 둔다. service_role 컨텍스트에서는 null이므로
-- 서버가 owner_id를 빠뜨리면 not-null 위반으로 실패한다 — 소유자 없는 행을 막는 안전장치.
--
-- 범위: 이슈 #45의 1번(프로젝트 생성)만. 2번(Storage 직접 업로드)은 킥오프 D5·D6 결정과
-- 얽혀 §4 절차가 필요하므로 분리한다.
-- ─────────────────────────────────────────────────────────────

drop policy if exists "owner_rw" on public.projects;

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
