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

프로덕션 실측(2026-08-01, 로그인 상태·프로젝트 1개·응답 4KB):

| 경로 | 중앙값 |
|---|---|
| 브라우저(서울) → Supabase 도쿄 **직접** | **16ms** |
| 브라우저 → Vercel 엣지 정적(`/guide`) | 227ms |
| 브라우저 → 함수(`iad1`) → Supabase | **1,770ms** |

**Supabase 자체는 16ms로 전혀 느리지 않다.** 쿼리·인덱스 튜닝으로는 이 격차가 줄지 않는다 —
비용의 대부분은 왕복 거리이지 DB 실행 시간이 아니다. 성능 문제를 만나면 **DB보다 리전과 왕복
횟수를 먼저 의심한다.**

- **리전을 바꾸면 `x-vercel-id`로 확인한다**: `icn1::iad1::…`처럼 **두 번째 코드가 붙으면** 함수가
  다른 리전에서 돈다는 뜻이다. 코드 하나(`icn1::…`)면 엣지에서 끝났거나 함수가 같은 리전에 있다
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
- `20260730130000_projects_insert_server_only.sql` (#45) — **코드 먼저.** `projects`의 INSERT
  정책을 없애 생성을 service_role로 좁히는 변경이라, 먼저 적용하면 그 순간부터 프로젝트 생성이 실패한다

파괴적 변경(제약 추가·정책 제거)은 **적용 전에 위반 행을 조회**하고, 결과를 마이그레이션 파일
주석과 `docs/PROGRESS.md`에 남긴다.

### 알아 둘 불일치 (해소 전)

- **로컬 파일과 원격 히스토리가 1:1이 아니다.** `20260724150000_fix_storage_object_rls.sql`은
  정책 자체는 적용·검증됐지만 원격 `supabase_migrations` 목록에 기록이 없고, 다른 파일들도
  로컬 파일명 타임스탬프와 원격 버전이 다르다. **`supabase db push`를 쓸 일이 생기면 이 불일치를
  먼저 정리해야 한다**
- **관리 방침(사용자 결정, 2026-07-30 — 이슈 #57)**: 최종적으로는 이력 누적이 아니라
  **최종 배포 스키마 하나를 정본으로** 통합한다. **착수 시점은 "최종 완료 시"** — 그때까지는
  현행(파일 누적)을 유지한다

---

## 남용 방어 (요약)

- 쓰기 경계는 **RLS + 경로 D 프로젝트 토큰**이 강제한다
- 레이트리밋은 `lib/abuse/rate-limit.ts` → `consume_rate_limit()` RPC(service_role 전용).
  **fail-open이다** — 카운터가 고장 나도 정상 편집을 끊지 않는다. 보안 경계는 RLS·토큰이 별도로 담당
- 남은 우회 경로 1건: **브라우저에서 Storage 직접 업로드**(이슈 #45의 2번). 킥오프의 D5·D6과
  얽혀 있어 손대려면 AGENTS.md 4절의 문서 변경 절차가 선행한다
