# @mockspec/web — 공개판 (Vercel + Supabase)

**https://draftify-html.vercel.app** — 공개 멀티테넌트 배포. 사내판(`packages/server`, Express·파일 저장)과
같은 저장소에 공존하며, **서빙 방식이 달라 제약이 정반대인 항목이 있다.**

이 README는 **공개판 고유의 운영 규칙**만 담는다. 중복을 만들지 않기 위해:

| 찾는 것 | 어디에 |
|---|---|
| 서비스 사용법·목업 zip 빌드법·두 배포 비교표 | 루트 [README.md](../../README.md) |
| Vercel 대시보드 설정값(Root Directory·Install Command 등) | 루트 [README.md](../../README.md) "공개판 배포" |
| 제품·기술 스펙 | [docs/README.md](../../docs/README.md) |
| 진행 상태·결정 이력 | [docs/PROGRESS.md](../../docs/PROGRESS.md) |
| 작업 규약(브랜치·병합·문서 변경 절차) | [AGENTS.md](../../AGENTS.md) |

---

## 사내판과 다른 점 (먼저 확인)

| | 사내판 | **공개판(이 앱)** |
|---|---|---|
| 목업 서빙 | 서브도메인 루트 (`{id}.localhost:4000/`) | **경로 접두** (`/m/{id}/`) + `<base href="/m/{id}/">` 주입 |
| 목업 zip | 절대·상대 둘 다 | **상대 base 필수** (`npx vite build --base=./`) |
| 지원 경로 | A(zip)·B(프록시)·D(확장) | **A·D만** — B는 SSRF 표면을 없애려고 제외 |
| 인증 | 없음(사내망 전제) | Google OAuth · 이메일 매직링크 |
| 저장 | 파일(`data/`) | Supabase Postgres + Storage(버킷 `mockups`) |

절대 경로로 빌드한 zip은 `/m/{id}/` 접두 **밖**을 가리켜 404가 되고, 화면이 빈 채로 열린다.
`<base>`는 상대 URL에만 적용되므로 서비스가 대신 고쳐 줄 수 없다.

---

## 로컬 개발

```bash
cp apps/web/.env.example apps/web/.env.local   # 값은 Supabase 대시보드에서
npm install                                    # 저장소 루트에서
npm run build                                  # ⚠️ 루트 선행 빌드 — 생략하면 아래가 실패한다
npm run dev -w @mockspec/web                   # http://localhost:3000
npm run typecheck -w @mockspec/web
npm run vercel-build -w @mockspec/web          # 루트 빌드 + 확장 ZIP + next build 한 번에
npm run test:e2e:web                           # 실 Supabase에 붙는다 — .env.local 없으면 스킵
```

- **⚠️ `apps/web`만 빌드하면 clean clone에서 실패한다.** 이 앱은
  `packages/viewer/dist/main.js`·`packages/sdk/dist/sdk.js`를 `?raw`로 인라인하는데, 그 산출물은
  gitignore 대상이라 새로 클론한 저장소에 없다. **루트 `npm run build`를 먼저 돌리거나**
  (`next dev`도 이 import를 타므로 dev에도 필요하다), 한 번에 하는 `vercel-build`를 쓴다 —
  `npm run build -w @mockspec/web` 단독 실행은 `next build` 도중 그 import에서 죽는다
- **`.env.local`은 gitignore 대상이라 어떤 클론에도 따라오지 않는다.** 새 환경에서는 직접 채워야
  하고, 없으면 Supabase 연동 Playwright는 설계대로 조건부 스킵된다(실패가 아니다)
- 로컬 로그인을 쓰려면 Supabase `Authentication → URL Configuration`에 `http://localhost:3000`
  계열 Redirect URL이 등록돼 있어야 한다(아래 참조)

---

## 배포

- **`main`이 프로덕션 브랜치다 — 병합하는 순간 공개 서비스에 반영된다.** 작업은 `main`에서 딴
  토픽 브랜치 → Preview로 확인 → PR → 병합. 병합에는 사용자 동의가 매번 필요하다(AGENTS.md 6절)
- 빌드는 `vercel-build`가 **저장소 루트부터** 돈다: `cd ../.. && npm run build && npm run build -w @mockspec/web`.
  `apps/web`이 `packages/viewer/dist/main.js`·`packages/sdk/dist/sdk.js`를 `?raw`로 인라인하므로
  다른 워크스페이스의 산출물이 먼저 존재해야 한다
- `build` 스크립트가 `scripts/package-extension.mjs`를 먼저 실행해
  **`/download/mockspec-extension.zip`을 결정적으로 패키징**한다. 이 ZIP은 커밋하지 않는다
  (원본은 `packages/extension/`, 버전 정본은 그 `manifest.json`의 `version`)

### 함수 리전 — `icn1` 고정 (`vercel.json`, 이슈 #71)

**서버리스 함수는 서울(`icn1`)에서 돌아야 한다. Supabase가 도쿄(`ap-northeast-1`)에 있기 때문이다.**

`vercel.json`이 없던 동안 함수 리전은 Vercel 기본값 **`iad1`(워싱턴 DC)**이었다. 그 결과 요청 한
건이 **태평양을 여러 번 건넜다** — 엣지(`icn1`)에서 함수(`iad1`)로 한 번, 거기서 도쿄 Supabase를
왕복 3~4회(미들웨어 `getUser` → 라우트 `getUser` → 조회 → export 요약).

프로덕션 실측(2026-08-01, 서울에서 · 로그인 상태 · 프로젝트 **1개** · 응답 **4KB** · 중앙값):

| 측정 대상 | iad1 (변경 전) | icn1 (변경 후) |
|---|---|---|
| 서울 → 도쿄 Supabase 왕복 (`/auth/v1/health`) | 16ms | — |
| 함수 SSR (`/login`, Supabase 미호출) | **330ms** | **74ms** |
| 콘솔 홈 HTML `/` (SSR + `getUser` 1회) | **916ms** | 측정 예정 |
| `/api/projects` (`getUser` 2회 + DB 2회) | **1,212ms** | 측정 예정 |

**이 측정에서 지배적인 비용은 왕복 거리였다.** 근거는 두 가지다 — ① 프로젝트가 1개, 응답이
4KB뿐인데도 API가 1.2초였다(데이터량으로 설명되지 않는다) ② **Supabase를 한 번도 호출하지 않는**
SSR 경로가 리전 이동만으로 330ms → 74ms가 됐다(홉 하나에서만 ~256ms).

주의해서 읽을 것:

- 위 16ms는 **`/auth/v1/health`에 대한 네트워크 왕복**이다. **DB 쿼리 실행 시간이 아니다** —
  "Supabase는 빠르다"의 근거로 쓰면 안 된다. 실행 시간이 문제로 의심되면 `explain analyze`로 따로 잰다
- 프로젝트 수·spec 크기가 커지면 **N+1(프로젝트당 export 요약 조회)과 목록 응답 크기**가 별도
  병목으로 올라온다. 이번에는 프로젝트 1개라 그 영향이 측정에 거의 잡히지 않았다
- 그래도 **순서는 리전이 먼저다** — 왕복 단가가 ~170ms일 때는 왕복 횟수를 줄여도 남는 비용이 크다

`x-vercel-id`로 어느 리전에서 돌았는지 확인한다:

- **두 번째 코드가 함수가 실행된 리전**이다. `icn1::iad1::…`이면 서울 엣지로 들어와 워싱턴 DC
  함수가 처리했다는 뜻이고, `icn1::icn1::…`이면 둘 다 서울이다. 코드가 하나뿐이면 엣지에서 끝났다
  (정적 캐시 HIT이거나 미들웨어가 응답을 만든 경우 — 함수 리전을 판정할 수 없다)
- **Preview로는 판정만 하고 시간은 재지 않는 편이 낫다.** Preview에는 Vercel SSO 검증이 얹히고,
  Supabase 세션 쿠키가 없어 로그인 상태를 만들 수 없다(curl은 302로 막힌다)
- Hobby 플랜은 리전을 **하나만** 지정할 수 있다. 배열에 둘 이상 넣으면 배포가 거부된다
- Supabase 프로젝트를 다른 리전으로 옮기면 **이 값도 같이 바꾼다** — 짝이 어긋나면 그대로 되돌아간다

### 환경변수

세 키 모두 **Production·Preview 양쪽**에 있어야 한다(Preview에서 로그인·저장이 죽지 않으려면).

| 키 | 성격 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 |
| `SUPABASE_SECRET_KEY` | **서버 전용.** `NEXT_PUBLIC_` 접두를 붙이면 브라우저 번들에 실려 RLS가 무력화된다 |

### Supabase URL 설정 (`Authentication → URL Configuration`)

- **Site URL**: `https://draftify-html.vercel.app`
- **Redirect URLs**: 프로덕션·로컬 각각 `/auth/callback`과 `/auth/confirm` — **총 4개**
  - `/auth/confirm`은 매직링크를 **다른 기기에서 열 때** 쓰는 경로다. 빠지면 그 케이스만 조용히 실패한다
- **Google OAuth**: Supabase가 중개하므로 배포 도메인이 늘어도 Google Cloud 쪽 작업은 없다
- **도메인이 바뀌면** `packages/extension/manifest.json`의 `host_permissions`를 **교체**한다
  (추가 아님, 와일드카드 금지 — [packages/extension/README.md](../../packages/extension/README.md))

---

## 마이그레이션 (`supabase/migrations/`)

> 최근 두 건에서 **적용 순서가 매번 판단 대상**이 됐다. 그 판단 기준을 여기 둔다.

### 전제 — Supabase 프로젝트는 하나뿐이다

**Preview와 Production이 같은 DB·Storage를 본다.** 따라서 마이그레이션을 적용하는 순간
**프로덕션에 즉시 걸린다.** "Preview에서 먼저 시험한다"가 성립하지 않는다.

### 순서 규칙 — "무엇이 무엇에 의존하는가"로 정한다

일률적인 정답이 없다. 방향은 둘 중 하나다:

| 변경 성격 | 순서 | 반대로 하면 |
|---|---|---|
| **코드가 스키마에 의존**<br>(예: `upsert`의 `onConflict`가 UNIQUE 제약을 요구) | **마이그레이션 먼저** → 코드 배포 | 배포된 코드가 없는 제약을 참조 → 그 기능이 프로덕션에서 즉시 죽는다 |
| **권한·정책을 좁힌다**<br>(예: INSERT 정책 제거로 쓰기를 서버로 회수) | 코드 배포 → **Production 배포 `success` 확인** → 마이그레이션 | 아직 구 코드가 돌고 있어 그 경로가 즉시 실패한다 |

실제 사례(둘 다 프로덕션 적용·검증 완료):

- `20260730070848_project_tokens_unique_project.sql` (#47) — **마이그레이션 먼저.** 제약 없이
  upsert만 돌리면 `there is no unique or exclusion constraint matching the ON CONFLICT
  specification`으로 **토큰 발급이 전면 실패**한다. 적용 전 중복 행을 먼저 조회해 0건임을 확인했다
- `20260730091840_projects_insert_server_only.sql` (#45) — **코드 먼저.** `projects`의 INSERT
  정책을 없애 생성을 service_role로 좁히는 변경이라, 먼저 적용하면 그 순간부터 프로젝트 생성이 실패한다

파괴적 변경(제약 추가·정책 제거)은 **적용 전에 위반 행을 조회**하고, 결과를 마이그레이션 파일
주석과 `docs/PROGRESS.md`에 남긴다.

### 스키마 정본과 이력 (2026-08-06 정리 완료 — 이슈 #57)

- **정본은 [`supabase/schema.sql`](./supabase/schema.sql) 한 파일이다.** "지금 프로덕션 스키마가
  무엇인가"의 답은 항상 이 파일이고, `migrations/`는 **적용 수단**으로 남는다. 변경 절차는
  **AGENTS.md 6절 "스키마를 바꿀 때"** 가 규약이다 (여기에 복제하지 않는다)
- **정본은 읽기용이다.** 빈 DB에 실행해 검증하지 않았고 할 계획도 없다 — 환경이 하나뿐이고
  개발용 분리 계획도 없다. **실제로 스키마를 세워야 하면 `migrations/`를 쓴다**(적용돼 증명된 경로)
- **로컬 ↔ 원격 이력 불일치는 해소됐다.** 누락돼 있던 `20260724150000_fix_storage_object_rls`를
  원격 이력에 등록하고, 로컬 파일 5본을 **원격의 실제 적용 버전으로 이름을 바꿨다.** 지금은
  로컬 7본 = 원격 7행이 파일명까지 일치한다

  | 종전 파일명 | 현재 파일명 |
  |---|---|
  | `20260722072600_init_open_service_schema` | `20260722082849_…` |
  | `20260722073000_harden_security_advisors` | `20260722083014_…` |
  | `20260722080000_projects_owner_default` | `20260722084918_…` |
  | `20260725090000_rate_limit_counters` | `20260725140447_…` |
  | `20260730130000_projects_insert_server_only` | `20260730091840_…` |

  `docs/PROGRESS.md`의 옛 기록은 당시 파일명을 그대로 쓴다 — 이 표로 대응시킨다.

---

## 남용 방어 (요약)

- 쓰기 경계는 **RLS + 경로 D 프로젝트 토큰**이 강제한다
- 레이트리밋은 `lib/abuse/rate-limit.ts` → `consume_rate_limit()` RPC(service_role 전용).
  **fail-open이다** — 카운터가 고장 나도 정상 편집을 끊지 않는다. 보안 경계는 RLS·토큰이 별도로 담당
- 남은 우회 경로 1건: **브라우저에서 Storage 직접 업로드**(이슈 #45의 2번). 킥오프의 D5·D6과
  얽혀 있어 손대려면 AGENTS.md 4절의 문서 변경 절차가 선행한다
