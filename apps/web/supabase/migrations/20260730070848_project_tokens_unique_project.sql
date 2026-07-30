-- ─────────────────────────────────────────────────────────────
-- project_tokens — 프로젝트당 토큰 행 1개를 DB에서 강제 (이슈 #47)
--
-- 재발급이 delete → insert 2단계라 원자적이지 않았다. 동시 요청이 겹치면 행이
-- 2개 남고, verifyToken()의 maybeSingle()이 에러를 내 **새 토큰 둘 다 무용지물**이
-- 된다(해당 프로젝트가 인증 불능으로 잠긴다). UNIQUE 제약이 그 상태를 원천 차단하고,
-- 동시에 tokenStore의 upsert({ onConflict: "project_id" })가 추론할 충돌 대상이 된다.
--
-- 적용 순서 주의: 이 마이그레이션이 코드 배포보다 **먼저**다. PostgREST의 on_conflict는
-- 대응하는 unique 인덱스가 없으면 요청 자체가 실패하므로, 제약 없이 upsert 코드만
-- 나가면 토큰 발급이 전면 중단된다.
--
-- revoked_at 관련: 현재 폐기는 행 DELETE라 revoked_at은 항상 null이다. 훗날 soft
-- revoke(행 보존)로 바꾼다면 이 제약을 `where revoked_at is null` 부분 인덱스로
-- 옮겨야 하고, 그때는 PostgREST가 충돌 대상을 추론하지 못하므로 upsert도 함께 바꿔야 한다.
-- ─────────────────────────────────────────────────────────────

alter table public.project_tokens
  drop constraint if exists project_tokens_project_id_key;

alter table public.project_tokens
  add constraint project_tokens_project_id_key unique (project_id);

-- UNIQUE 제약이 만드는 인덱스가 project_id 조회를 그대로 커버한다 → 중복 인덱스 제거.
drop index if exists public.project_tokens_project_idx;
