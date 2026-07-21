# RFC — 공개 서비스 개편 (Vercel + Supabase)

> **상태: RFC 초안 (탐색 단계).** 스코프가 굳으면 정식 킥오프 스펙(`guide/open-service-kickoff-spec.md`)으로
> 승격하고, PRD §7.1 로드맵·NFR-01·§7.2를 동기화한다. 아직 구현 착수 문서가 아니다.
>
> 이 문서는 "사내망·무인증 로컬/사내 서버" 전제로 만들어진 현 제품을 **공개 URL로 기획자들이
> 직접 접속해 쓰는 멀티테넌트 서비스**로 여는 개편의 설계 계약 초안이다. 논의·결정을 여기에
> 누적하고, 확정된 항목과 열린 질문을 구분해 기록한다. 갱신 규약은 [AGENTS.md](../AGENTS.md) §3·§4.

---

## 1. 동기

- 가능성 타진을 넘어, **공개 URL에 접속해 기획자들이 실제로 사용해보는 환경**을 만든다.
- 이는 PRD §7.2 SSO/인증 도입 조건 중 "다수 사용자·소유권 정리 필요"에 해당하는 **실수요 발생**이다.
  따라서 그간 YAGNI로 미뤄둔 DB·인증을 정당하게 앞당긴다.
- 개편은 단계(stage) 레벨의 방향 전환이므로 개별 GitHub 이슈가 아니라 이 RFC(→ 킥오프 스펙)가
  진실의 원천이고, GitHub은 워크스트림별 추적판(엄브렐라 이슈 + 하위 이슈)으로만 쓴다.

## 2. 무엇이 불변이고 무엇이 열리나

**불변 — PRD §1.3 제1원칙 4개는 그대로 유지된다. 개편 대상이 아니다:**
1. 의도는 사람이 입력한다 (LLM 미사용 기본)
2. 사용자는 목업을 수정하지 않는다 (서비스가 SDK 주입)
3. 편집은 라이브, 산출물은 캡처
4. 캡처는 사용자 브라우저에서 (서버 헤드리스 재현 금지)
   → **산출물 = 단독 HTML, 네트워크 0건**도 불변.

**재협상 — 딱 하나의 전제가 무너지고, 그로부터 파생되는 것들만 바뀐다:**
- `NFR-01` "사내망 전제 + 비추측 ID + 무인증" → **폐기.** 공개 인터넷 + 인증 + 소유자별 격리로 대체.
- `PRD §7.2` "인증은 YAGNI" → **조건 충족으로 해제.**

## 3. 확정된 결정 (2026-07-21 논의)

| # | 결정 | 근거 |
|---|------|------|
| D1 | **완전 공개 가입 + 단일 인증 체계.** SSO 없음. **Google OAuth + Supabase 이메일(매직링크) 둘 다 제공** — 사용자가 선택 | 사용자 결정(2026-07-21). Supabase Auth가 두 provider를 한 세션 체계로 통합 |
| D2 | **경로 B(URL 프록시) 공개판에서 제외.** 프록시는 서버가 업스트림 호스트를 대신 fetch하는 별도 호스트 발생 구조라 서버리스·공개판 양쪽과 부적합. 공개판은 **경로 A(zip) + 경로 D(확장)만** 지원 | 사용자 결정. SSRF 위험 표면도 함께 소멸 |
| D3 | **호스팅은 서버리스만 가능 → Vercel 확정.** 상주 컨테이너 불가 | 사용자 결정 (인프라 제약) |
| D4 | **데이터·인증·저장은 Supabase.** Postgres(메타·spec) + Storage(목업·asset) + Auth | 서버리스에서 영속 상태를 얹는 표준 조합 |
| D5 | **zip 해제를 브라우저로 이관.** 업로드 시 클라이언트가 unzip → 파일별 Storage 직업로드 → manifest를 API에 통보 | 서버리스엔 영속 디스크가 없다. 서버 스트리밍 해제 폐기 |
| D6 | **SDK 주입은 인제스트(업로드) 시점 1회 — 클라이언트가 브라우저에서 수행.** unzip과 함께 HTML에 SDK 태그·`<base>`를 삽입한 주입본을 Storage에 올리고, 서버는 검증만(D5와 일관 — 서버는 파일 미조작). 이후 서빙은 정적. SDK 갱신은 버전 쿼리 | 서빙마다 변조하는 상주 서버 모델은 서버리스에 안 맞고, 서버 파일 조작 없이 D5와 일관 |
| D7 | **목업 격리는 경로 접두 방식** `/(오리진)/m/{projectId}/...`. **v1은 콘솔과 같은 오리진**(옵션 2), 프로젝트별 서브도메인·와일드카드 인증서 불필요. 신뢰불가 목업의 오리진 격리(옵션 1·방법 B)는 §7 승격 경로로 유보 | 프록시 제거로 정적 목업만 남음. 단 공개 업로드=임의 JS라 오리진 경계는 사소하지 않음(§7). v1은 소유자-전용 서빙+사용 제약으로 수용 |
| D8 | **프레임워크는 Next.js**(콘솔 UI + API 라우트 + 미들웨어 + Supabase Auth 연동) | Vercel 서버리스에서 가장 짧은 경로 |

## 4. 목표 아키텍처

```
┌────────────────────────────────────────────────────────────┐
│  Vercel (Next.js)                                           │
│  ├─ 콘솔 UI (기존 vanilla 콘솔 → Next 페이지로 이식)          │
│  ├─ 미들웨어: /m/{id}/* 경로 격리 라우팅                      │
│  └─ API 라우트 (서버리스 함수)                                │
│       업로드 인테이크 · spec GET/PUT · asset · export · 토큰   │
└───────────────┬───────────────────────────┬────────────────┘
                │                           │
        ┌───────▼────────┐          ┌───────▼──────────┐
        │ Supabase        │          │ Supabase Storage │
        │  Auth (D1)      │          │  목업 파일 버킷    │
        │  Postgres       │          │  asset(스냅샷) 버킷│
        │   projects/     │          └──────────────────┘
        │   tokens/exports│
        │   + RLS 격리     │
        └─────────────────┘
```

| 관심사 | 현재 (파일 기반 Express) | 개편 (Vercel + Supabase) |
|--------|--------------------------|--------------------------|
| 인증 | 없음 | Supabase Auth (D1) |
| 메타·spec 저장 | `data/projects/{id}/spec.json` | Postgres `projects.spec` (JSONB 통짜) — 현 "문서 전체 교체 PUT" 모델과 정합 |
| 목업 파일 | 디스크 `mockup/` (zip 해제본) | Storage 버킷 `projects/{id}/mockup/**` (D5 클라이언트 업로드) |
| asset(스냅샷) | 디스크 `assets/` | Storage 버킷 `projects/{id}/assets/**` |
| 토큰(경로 D) | `tokens.json` 해시 | Postgres `project_tokens` (해시 저장 불변) |
| 산출물 이력 | `exports.json` | Postgres `project_exports` |
| 목업 서빙+주입 | 서빙 때 HTML 변조 | 인제스트 때 1회 주입(D6) → 정적 서빙 |
| 라우팅 | Host 헤더 서브도메인 분기 | `/m/{id}/*` 경로 미들웨어 (D7) |
| 프록시(경로 B) | 있음 | **제거 (D2)** |

## 5. 데이터 모델 → Postgres 스키마 스케치

`shared/types.ts`의 `SpecProject`는 **그대로 JSONB 1컬럼**으로 넣는다(정규화하지 않음 — "단순·범용" 원칙). RLS로 소유자 격리.

**컬럼 vs JSONB 중복 처리 (원천 명시)**: `spec` JSONB(`SpecProject`)가 **유일한 진실의 원천**이다.
최상위 컬럼 `name`·`updated_at`은 목록 조회·정렬·인덱싱을 위한 **파생 투영**이며, spec을 쓰는
경로(생성·PUT)에서 **같은 트랜잭션 안에서 spec 값으로 덮어쓴다**(애플리케이션 또는 트리거로 동기화 강제).
읽기 응답은 spec을 원천으로 반환한다. `id`는 PK 겸 spec.id로 불변이라 중복이 아니라 동일 키.

```sql
-- 소유자 = auth.uid(). RLS가 교차 접근을 DB 레벨에서 차단.
create table projects (
  id          text primary key,          -- "prj_" + nanoid(10) = spec.id (동일 키, 불변)
  owner_id    uuid not null references auth.users(id),
  name        text not null,             -- 파생 투영: PUT 시 spec.name으로 동기화 (목록/정렬용)
  spec        jsonb not null,            -- 진실의 원천. SpecProject 직렬화 그대로 (mockupSource는 upload|snippet만)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()  -- 파생 투영: PUT 시 spec.updatedAt으로 동기화
);
alter table projects enable row level security;
create policy "owner_rw" on projects
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table project_tokens (   -- 경로 D 저장 인증. 평문 미보관 (해시만)
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  token_hash  text not null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
alter table project_tokens enable row level security;   -- 하위 테이블도 소유자 격리 (부모 JOIN)
create policy "owner_token_rw" on project_tokens
  using (exists (select 1 from projects p
                 where p.id = project_tokens.project_id and p.owner_id = auth.uid()));

create table project_exports (  -- 산출물 이력 메타 (ExportRecord)
  id          text primary key,
  project_id  text not null references projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  spec_updated_at timestamptz not null,
  bytes       int not null,
  masked      boolean not null
);
alter table project_exports enable row level security;  -- 하위 테이블도 소유자 격리 (부모 JOIN)
create policy "owner_export_rw" on project_exports
  using (exists (select 1 from projects p
                 where p.id = project_exports.project_id and p.owner_id = auth.uid()));
```

**Storage 오브젝트 RLS (별도·필수).** Postgres 테이블 RLS는 `storage.objects`를 제약하지 **않는다.**
D5에서 브라우저가 버킷 `projects/{projectId}/...`에 직접 업로드하므로, 경로의 `{projectId}`가 `auth.uid()`
소유인지 검증하는 **버킷 정책**이 없으면 인증된 사용자 A가 B의 목업/asset을 덮어쓰거나 읽을 수 있다.
insert·select·update·delete 전부에 적용한다. (경로 D 저장은 토큰 인증 경로라 별도 — §6.)

```sql
-- 목업·asset 버킷(예: "mockups"). 경로 첫 세그먼트가 "projects/{id}" 형태라고 가정.
-- storage.foldername(name)[1]='projects', [2]=projectId 를 파싱해 소유권 확인.
create policy "owner_storage_all" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'mockups'
    and (storage.foldername(name))[1] = 'projects'
    and exists (select 1 from projects p
                where p.id = (storage.foldername(name))[2] and p.owner_id = auth.uid())
  )
  with check (
    bucket_id = 'mockups'
    and (storage.foldername(name))[1] = 'projects'
    and exists (select 1 from projects p
                where p.id = (storage.foldername(name))[2] and p.owner_id = auth.uid())
  );
```

- `ownerLabel`(자유 텍스트 라벨)은 유지하되 **표시용**으로 남기고, 실제 소유·권한은 `owner_id`가 담당한다.
- `MockupSource` union에서 `ProxyMockupSource`는 공개판 코드 경로에서 제거(D2). 타입은 하위 호환 위해
  남겨두되 공개 인테이크에서 거부.
- **RLS는 세 테이블 + Storage 오브젝트 모두 활성화**한다. 하위 테이블(`project_tokens`·`project_exports`)은
  부모 `projects`를 JOIN해, Storage는 오브젝트 경로의 `{projectId}`를 JOIN해 소유권을 확인하므로
  애플리케이션 버그가 나도 남의 데이터에 닿지 않는다. **버킷은 비공개**(public read off).
- **권한 모델 v1**: 프로젝트는 생성자 단독 소유(개인 소유 플랫). 팀 공유·역할(editor/viewer)·조직 계층은
  다음 단계(§9 열린 질문).

## 6. 플로우별 서버리스 함수 설계

| 함수 | 입력 | 동작 |
|------|------|------|
| `POST /api/projects` | 이름, (선택)ownerLabel | 인증 확인 → `projects` 행 생성(owner_id=auth.uid) |
| **업로드(경로 A)** `POST /api/projects/{id}/mockup:complete` | 클라이언트가 Storage에 이미 올린 파일 manifest | **서버는 파일을 만지지 않는다(D5·D6 확정).** 클라이언트가 브라우저에서 **unzip + SDK 태그 주입 + `<base>` 삽입까지 완료한 주입본**을 Storage에 올리고, 서버는 manifest 검증(엔트리 존재·주입 태그 유무·경로 안전성)만 수행. `mockupSource=upload` 확정 |
| **목업 서빙** `/m/{id}/*` (**Route Handler**, 미들웨어 아님 — Codex P1) | 경로 | **소유자 인증 경유(v1) — 익명 공개 접근 아님.** 미들웨어는 인증·리라이트만 담당하고(Edge 미들웨어는 응답 본문 스트리밍 불가), 실제 서빙은 Route Handler(서버리스)가 소유권 검증 후 비공개 Storage에서 스트림. HTML은 이미 주입본(D6)·`<base>` 삽입됨. **SPA history fallback**: 확장자 없는 미존재 경로(`/m/{id}/settings` 등 클라이언트 라우트·새로고침)는 프로젝트 `index.html`로 폴백(FR-ONB-04·현 `serve.ts` 동작 유지) |
| **spec GET/PUT** `/api/projects/{id}/spec` | (PUT) SpecProject 전체 | 전체 교체 PUT 유지. asset GC(ID-11)는 Storage 삭제로 이식 |
| **asset** `POST/GET /api/projects/{id}/assets` | 스냅샷 바이트 | 비공개 Storage 버킷 read/write. 브라우저 직접 업로드는 **Storage 오브젝트 RLS**(§5)가 `projects/{id}/` 소유권 강제. 경로 D는 토큰 인증 |
| **export** `POST /api/projects/{id}/export` | — | 기존 `buildExportHtml`+뷰어 번들 재사용. asset을 Storage에서 fetch해 인라인. 큰 산출물은 Storage에 쓰고 signed URL 반환(함수 응답 크기 한계 회피) |
| **토큰(경로 D)** `POST /api/projects/{id}/tokens` | — | 발급 시 평문 1회 노출, 해시만 저장. 재발급·폐기 |
| **auth** | Supabase Auth 콜백 | D1 |

- **함수 시간·크기 한계 유의점**: zip 해제(브라우저로 이관, D5)·export 산출물(Storage+signed URL)로
  회피. 개별 서버리스 함수는 짧은 read/transform/write만 담당.

## 7. 경로 격리(D7) 메커니즘·보안 경계·승격 경로

### 7.1 경로 격리 메커니즘

- **방식**: `/m/{id}/` 접두 아래 서빙. **미들웨어는 인증·리라이트만**, 실제 파일 스트리밍은 **Route Handler**가
  수행한다(Codex P1 — Next Edge 미들웨어는 비공개 Storage 오브젝트의 응답 본문을 스트리밍할 수 없다).
  Handler가 `{id}`를 파싱해 소유권 검증 후 Storage 프리픽스에서 스트림.
- **상대 경로**: 인제스트 시 HTML `<head>`에 `<base href="/m/{id}/">` 주입 → 상대 리소스 자동 해결.
- **SPA history fallback (FR-ONB-04 — 회귀 금지)**: 확장자 없는 미존재 경로(SPA 클라이언트 라우트·그 위치
  새로고침, 예 `/m/{id}/settings`)는 프로젝트 루트 `index.html`로 폴백한다. 현 `packages/server/src/routes/serve.ts`가
  이미 제공하는 동작 — Next 이식 시 반드시 보존(W4).
- **알려진 제약(정직히 명시)**: **절대 루트 경로**(`/assets/app.js`)를 쓰는 목업은 접두 밖으로 나가 깨진다.
  → **온보딩 제약으로 문서화**("빌드 base path를 프로젝트 경로에 맞추거나 상대 경로로 빌드"). 대부분의
  정적 빌드 도구가 base/publicPath 설정을 지원. 필요 시 후속으로 인제스트 시 절대경로 재작성 추가.

### 7.2 신뢰불가 목업의 오리진 경계 (PR #35 Codex P1-B)

- **문제**: 공개 ZIP 업로드는 정적 파일이 아니라 **임의 JavaScript를 담은 동작 웹앱**이다. 이를 콘솔/API와
  **같은 오리진**(`/m/{id}/`)에서 서빙하면, 목업의 악성 JS가 same-origin으로 `/api`에 **인증 세션을 달고**
  요청을 보낼 수 있다(SDK `fetchTransport`도 same-origin — `packages/sdk/src/transport.ts`). 원래 제품이
  프로젝트별 서브도메인을 쓴 이유가 바로 이 오리진 격리였다. same-origin은 "localStorage 충돌" 수준의
  사소한 문제가 아니라 **인증 경계**다.
- **v1 완화(채택 — 옵션 2)**: 목업 서빙을 **소유자 인증 경유**(§6, 익명 접근 없음)로 한정 → 남이 만든
  악성 목업을 피해자가 열 수 없으므로 **교차 테넌트 공격은 차단**된다(피해자가 못 열고, RLS가 타 소유자
  접근을 막음). **남는 위험**은 자기 계정 범위: 기획자가 외부에서 받은 신뢰불가 ZIP을 올려 열면 그 JS가
  기획자 자신으로서 자기 프로젝트를 조작(self-XSS/CSRF급). → **사용 제약으로 문서화**("자기 팀이 빌드한
  믿을 수 있는 ZIP만 업로드").
- **v1 전제**: 내부 기획자가 자기(팀) 목업만 올린다. 외부 공유(§9-8)는 v1에 없다.

### 7.3 승격 경로 — 옵션 1 (방법 B, 무료 오리진 격리)

**§9-8 외부 공유를 열기 전에 반드시 선행**한다. 신뢰불가 목업을 콘솔/API와 **다른 오리진**에서 서빙:

- **오리진 1개만 추가**(목업 ↔ 목업 격리는 불필요 — usercontent 오리진엔 API·세션이 없어 훔칠 게 없다).
  모든 목업이 그 한 오리진의 경로(`/m/{id}/`)로 서빙된다. **업로드마다 도메인 발급하는 배관은 없다.**
- **무료 실현(방법 B)**: Vercel Hobby에서 프로젝트 2개 → `*-console.vercel.app` / `*-usercontent.vercel.app`.
  서로 다른 오리진 + `vercel.app`은 PSL 등재라 쿠키 공유도 차단. **도메인 구매 불필요.** (본인 도메인
  서브도메인=방법 A는 도메인 구매가 필요해 배제.)
- **인증 배관 (Codex P2 — 오브젝트 단위 서명 URL로는 불충분)**: 엔트리 HTML 하나에 대한 서명 URL은
  **그 오브젝트만** 인가한다. 상대 리소스(JS/CSS/청크) 요청은 그 query capability를 물려받지 못하고,
  주입된 `<base>`가 usercontent 오리진을 가리키므로 자산이 안 붙는다. 또 서명 URL 직접 로드는 페이지를
  Storage 오리진에 올려 의도한 usercontent Vercel 오리진이 아니게 된다. → **usercontent 오리진에 Route
  Handler를 두고, 프로젝트 단위 단기 capability**(콘솔이 발급한 프로젝트 스코프 서명 토큰/쿠키를
  usercontent 오리진에서 검증)로 **그 프로젝트의 모든 오브젝트를 인가**한다. 오브젝트마다 개별 서명하는
  방식은 SPA 자산·청크에 비현실적.
- **대가**: 목업이 다른 오리진이 되면 경로 A 편집 SDK의 same-origin 저장이 막혀 **CORS+토큰 저장**으로
  전환해야 한다 — 경로 D(확장)가 이미 쓰는 패턴이라 새 발명은 아니다.

### 7.4 오리진 공유의 부작용 (v1)

프로젝트 간 localStorage/쿠키 공유(같은 오리진). 정적 목업이라 실제 충돌은 드물다. 7.3 승격 시 함께 해소.

## 8. 코드 영향 범위 — 무엇이 살고 무엇이 재작성되나

| 패키지 | 개편 영향 |
|--------|-----------|
| `shared` (타입 계약) | **거의 그대로 생존.** `MockupSource`에서 proxy 경로 배제 정도 |
| `sdk` (Preact/Shadow DOM, 페이지 주입 편집기) | **그대로 생존** — 클라이언트 코드. 저장 API 엔드포인트 URL만 조정 |
| `viewer` (단독 산출물 런타임) | **그대로 생존** |
| `server` (Express) | **서버리스 함수 / Next API 라우트로 재작성.** 스토어 4모듈(projectStore·exportStore·tokenStore·paths)이 이미 격리돼 있어 Supabase 호출로 교체가 국소적. serve.ts(디스크 서빙)·proxy.ts(제거)·unzip(브라우저 이관)이 주요 변경 |
| 콘솔 UI | vanilla → Next 페이지로 이식 (기능 동등) |

→ **제품 재작성이 아니라 "서버 계층 이식 + 콘솔 프레임워크 이식".** 편집기·뷰어·타입은 보존.

## 9. 열린 질문

**결정됨 (2026-07-21):**
1. ~~인증 방식~~ → **Google OAuth + Supabase 이메일 매직링크 둘 다 제공**, 사용자가 선택(D1).
2. ~~권한 모델 확장 시점~~ → **실수요까지 유보(YAGNI).** v1은 개인 소유 플랫. 여러 명이 한 프로젝트를
   편집/열람할 실수요가 생길 때 팀 공유·역할·조직을 설계한다. 프로젝트 철학(단순·범용)과 일관. 스키마에
   멤버십을 선반영하지 않는다.

3. ~~기존 `data/` 런타임 데이터 이관~~ → **이관 없음, 빈 DB로 시작.** 기존 `data/projects/*`는 기존
   file-based 배포에서 **내부 시연·설명 용도로만** 유지되는 폐기 대상이므로 새 Supabase로 옮기지 않는다.
   이관 스크립트 불필요. (코드/레포는 §8대로 이 레포에서 진화 — 데이터 폐기와 무관.)

**남은 것 (저강도 — 킥오프 승격 시 확정 가능):**
4. **절대경로 목업 대응**: 온보딩 제약 문서화로 충분한가, 인제스트 재작성까지 넣을 것인가.
5. **경로 D 확장의 공개 백엔드 저장**: 확장이 공개 도메인으로 저장 시 CORS·토큰 흐름 재확인.
6. **저장 쿼터·레이트리밋·업로드 파일 검증**: 공개 노출로 새로 필요한 남용 방어(사내망일 땐 불요).
7. **마이그레이션 브랜치 전략**: major 개편이므로 장기 브랜치 vs 점진 이관.
8. **목업의 외부 공유 여부**: v1은 목업 서빙을 소유자 인증 경유로 확정(§6, 익명 접근 없음). 소유자가
   아닌 사람에게 편집 화면을 보여줄 필요가 생기면 — 링크 공유(비추측 토큰)·읽기 전용 뷰어 등 —
   별도 설계. **그리고 이때 §7.3 오리진 격리(옵션 1·방법 B)를 선행해야 한다** — 공유가 열리면 신뢰불가
   목업 JS의 교차 테넌트 공격 표면이 다시 열리기 때문. 현재 공유 수단은 여전히 **단독 산출물 HTML**(§2 불변).

## 10. WBS 스케치 (승격 시 technical-spec §9.2로 이동)

- [ ] W1 Supabase 프로젝트·Auth(D1 — **Google OAuth + 이메일 매직링크 둘 다**)·스키마(§5)·RLS 세팅 — **테이블 3종 + Storage 오브젝트 정책 + 버킷 비공개 포함**
- [ ] W2 스토어 4모듈 → Supabase(Postgres+Storage) 어댑터 교체
- [ ] W3 업로드 인테이크: 브라우저 unzip + Storage 직업로드 + SDK 주입(D5·D6)
- [ ] W4 목업 서빙 `/m/{id}/*` — **Route Handler**가 소유권 검증+스트림(미들웨어는 인증·리라이트만), `<base>` + **SPA history fallback(FR-ONB-04)** 보존(D7·§7.1)
- [ ] W5 spec GET/PUT·asset·export 함수 이식 (asset GC·export 조립 재사용)
- [ ] W6 경로 D 토큰 인증 이식 + 확장 저장 대상 URL 전환
- [ ] W7 콘솔 UI Next 이식 + Auth 게이트
- [ ] W8 남용 방어(쿼터·레이트리밋·업로드 검증) — 열린 질문 6 결정 후
- [ ] W9 E2E: 가입→업로드→편집→export→뷰어 공개 시나리오

## 11. 결정 변경 이력

- 2026-07-21 — RFC 개설. 확정 D1~D8 기록(§3). NFR-01·§7.2 재협상은 킥오프 승격 시 원본(PRD·킥오프 스펙)에 반영 예정.
- 2026-07-21 — PR #35 Gemini 리뷰 4건 반영: ① §5 컬럼 vs JSONB 중복 — spec을 원천으로 명시, 최상위 name·updated_at은 쓰기 시 동기화되는 파생 투영으로 정리 ② §5 하위 테이블 RLS 누락 — project_tokens·project_exports에 RLS 활성화 + 부모 JOIN 소유자 정책 추가 ③ §6·D6 SDK 주입 주체 모호 — "클라이언트가 브라우저에서 unzip+주입 완료, 서버는 검증만"으로 D5와 일관되게 확정 ④ §6 목업 서빙 인가 경로 미명시 — "소유자 인증 경유(v1)·익명 접근 없음"으로 확정, 외부 공유는 §9-8 열린 질문으로 분리.
- 2026-07-21 — PR #35 Codex P1-A 반영: **Storage 오브젝트 RLS 누락.** Postgres 테이블 RLS는 `storage.objects`를 제약하지 않으므로, D5 브라우저 직접 업로드에 대비해 `storage.objects`에 `projects/{id}/` 경로 소유권을 검증하는 버킷 정책(insert/select/update/delete) 추가 + 버킷 비공개 명시. §5·§6 asset 행·W1 반영.
- 2026-07-21 — PR #35 Codex 3차 리뷰 3건 반영: ① P1 **SPA history fallback** — `/m/{id}/` 라우팅이 확장자 없는 미존재 경로를 프로젝트 index.html로 폴백하도록 §6·§7.1·W4에 명시(FR-ONB-04·현 serve.ts 회귀 방지) ② P1 **미들웨어 스트리밍 불가** — 목업 서빙을 미들웨어에서 Route Handler로 이동(Edge 미들웨어는 응답 본문 스트리밍 불가), 미들웨어는 인증·리라이트만. §6·§7.1·W4 반영 ③ P2 **격리 오리진 자산 인가** — §7.3 승격 경로에서 오브젝트 단위 서명 URL로는 상대 자산·청크가 인가 안 됨(base가 usercontent 오리진 지시), usercontent Route Handler + 프로젝트 단위 단기 capability로 전체 오브젝트 인가하도록 정교화.
- 2026-07-21 — PR #35 Codex P1-B 결정·반영: **신뢰불가 목업의 오리진 경계.** 사용자 결정 — **v1은 옵션 2**(콘솔과 같은 오리진 + 소유자-전용 서빙으로 교차 테넌트 차단 + "믿을 수 있는 ZIP만 업로드" 사용 제약), **방법 B(Vercel Hobby 프로젝트 2개로 무료 오리진 분리 + Storage 서명 URL 인증)를 승격 경로로 기록**하고 §9-8 외부 공유 개방 전 선행 필수로 못 박음. D7 문구 갱신, §7을 7.1~7.4로 재구성(메커니즘·보안 경계·승격 경로·부작용). 방법 A(본인 도메인 서브도메인)는 도메인 구매 필요로 배제. 오리진 격리는 목업 전체 대 콘솔 사이만 필요하므로 오리진 1개 추가로 충분(업로드별 도메인 발급 불요).
- 2026-07-21 — 열린 질문 2건 결정: **인증(§9-1)** = Google OAuth + Supabase 이메일 매직링크 **둘 다 제공**(D1·W1 갱신). **권한 모델 확장(§9-2)** = **실수요까지 유보(YAGNI)**, v1 개인 소유 플랫·멤버십 스키마 선반영 안 함. §9를 "결정됨/남은 것"으로 재구성. **기존 `data/` 데이터 이관(§9-3)은 대기** — "완전 대체"가 레포 파기로 오해돼, 코드는 §8대로 이 레포에서 진화하고 데이터 이관 여부만 남은 질문임을 명확화.
- 2026-07-21 — 기존 데이터 이관(§9-3) 결정: **이관 없음, 빈 DB로 시작.** 기존 `data/`는 기존 file-based 배포에서 내부 시연·설명 용도로만 유지되는 폐기 대상 — 새 Supabase로 옮기지 않음. 이관 스크립트 불필요. 남은 질문은 저강도 4건(절대경로 목업·경로 D CORS·쿼터·브랜치 전략)뿐 — 킥오프 승격 시 확정.
