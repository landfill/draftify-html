# PROGRESS — 작업 진행 로그

> 이 파일은 여러 에이전트·여러 세션에 걸친 작업 인수인계의 단일 진실 공급원이다.
> Claude Code의 개인 메모리(`~/.claude/projects/.../memory/`)는 세션·머신·에이전트 종류가
> 바뀌면 접근할 수 없다. 이 프로젝트에 관한 진행 상태·결정·다음 할 일은
> 전부 이 파일(과 `docs/`의 스펙 문서)에 남긴다. 개인 메모리에는 남기지 않는다.
>
> 갱신 규약은 [AGENTS.md](../AGENTS.md) §3 참조.

## 현재 단계

**S1 WBS 전 항목(T1~T10) 완료 + zip 최상위 폴더 언랩 개선(main 병합 완료). 남은 것: 실사용 1회 판정(킥오프 §11 기록) → S2 계획.**

## WBS 체크리스트

원본: `technical-spec.md` §9.2 / `guide/s1-kickoff-spec.md` §10. 두 원본을 고치면 이 표도 같이 갱신한다.

- [x] T1 모노레포 셋업 + shared 타입 (`packages/shared/src/types.ts`가 3패키지에서 import됨) — `npm run build` exit 0, `npm test` 2 passed
- [x] T2 서버: 업로드·해제·정적 서빙·SDK 주입 (zip 업로드 → 서브도메인에서 목업 열림, zip-slip 테스트 통과) — vitest 20 passed, 실기동 curl 스모크 통과
- [x] T3 Spec API + 파일 저장 (전체 엔드포인트 vitest, 왕복 무손실) — vitest 27 passed, PUT 왕복 무손실·ID-11 asset 정리 검증
- [x] T4 SDK: FAB·패널·모드 전환 (Shadow DOM 격리) — Vite IIFE 단일 sdk.js(18.6KB), 실 Chrome에서 FAB·도킹·모드·격리·클릭차단 검증
- [x] T5 SDK: 어노테이션·앵커·마커 (재탐색 성공 1케이스 포함) — 앵커 유닛 9개 + 실 Chrome에서 부착·재탐색·rect fallback 검증
- [x] T6 SDK: 장면 등록 + 동결 (단독 오픈 시 시각적 동일 + `<script>` 0개) — freeze 유닛 5개 + 실 Chrome에서 동결·업로드·`<script>` 0개·CSS/SVG 인라인·단독 시각 동일 검증
- [x] T7 SDK: 저장·오프라인 큐 (서버 중단 후 재기동 시 자동 반영) — SDK App 테스트로 PUT 실패→localStorage 보관→2초 재시도 성공 검증, vitest 53 passed
- [x] T8 뷰어 + export 조립 (산출물 HTML이 file://로 열림) — export API + viewer 런타임 테스트, Chrome file:// 스모크(마커·패널·iframe·외부 네트워크 0건) 통과
- [x] T9 콘솔 페이지 (업로드→편집 열기→export가 콘솔만으로 가능) — vitest 68 passed, 실 Chrome에서 콘솔 업로드→장면 등록→export 다운로드 검증
- [x] T10 E2E (Playwright) — S1 Definition of Done 시나리오 자동화 — `npm run test:e2e` 1 passed(4.4s), vitest 68 passed 회귀 없음

## 세션 로그 (최신이 위)

### 2026-07-10 — 루트 README.md 사용 가이드 신설
- 브랜치: `docs/root-readme-usage-guide` (main 미병합, 동의 대기).
- 배경: 실사용 판정을 앞두고 "서버 실행·사용 방법"이 어느 문서에도 없음을 확인 — 기존 문서는 전부 만드는 사람 관점(스펙·규약·진행 로그). 가이드 부재 시 실사용에 "저장소를 아는 사람"의 도움이 필요해져 S1 취지(목업 팀 도움 없이)와 어긋남.
- 완료: 루트 `README.md` 신설 — 요구 환경, 서버 실행(PORT·MOCKSPEC_DATA_DIR env), 목업 zip 준비(빌드 산출물·언랩·200MB·base 조건), 업로드→편집(장면 등록·어노테이션·모드·자동 저장), 내보내기→file:// 검증 체크리스트, 테스트 명령, 저장소 구조. `docs/README.md` 서두에 상호 링크 추가.
- 검증: 문서만 변경 — 코드·테스트 무영향. 가이드 내용은 detailed-spec §2~4·technical-spec §3·킥오프 §4와 대조해 작성.
- 다음 할 일: 이 브랜치 병합 후, 실사용 1회(팀 내 실제 목업으로 기획서 1부) → "목업 팀 도움 없이 가능했는가" 판정을 킥오프 스펙 §11에 기록 → S2 계획 입력.
- 막힌 지점: 없음.

### 2026-07-10 — zip 최상위 폴더 자동 언랩 (실사용 준비 개선)
- 브랜치: `feat/zip-root-unwrap` → `main` 병합 완료(2026-07-10, fast-forward). 병합된 작업 브랜치들(T6~T10·fix 포함)은 로컬에서 삭제 정리.
- 배경: 사용자는 보통 `dist` 폴더를 통째로 압축하므로 zip 루트가 `dist/`가 되어 "루트 index.html 없음"(T9 검증)으로 거부됨 — 실사용 판정 전에 발견된 UX 함정. 규약 §4 절차로 진행: 킥오프 §11 **3차 개정** 기록 → §4 본문 추가 → `technical-spec.md` §3.2·`detailed-spec.md` §2.2/엣지 표 동기화 → 구현.
- 완료: `extract.ts::commonRootPrefix` — 제외 필터 적용 후 모든 엔트리가 공유하는 최상위 디렉토리 체인(중첩 `project/dist`도 전부)을 벗겨 루트로 승격. 각 엔트리는 파일명 1세그먼트를 반드시 남기고, `..`·`.` 세그먼트는 접두 불가(zip-slip 검증은 언랩된 경로에 그대로 적용 — 우회 불가). `ExtractResult.strippedRoot`로 업로드 응답에 포함, 콘솔이 "최상위 폴더 'dist/'를 벗겨 해제했습니다" 표시.
- 검증: `npm run typecheck` exit 0, `npm test` **75 passed**(+7: extract 언랩 6 — 단일/중첩/루트 파일 존재 시 무언랩/제외 대상 공존/단일 파일/zip-slip 우회 불가, 업로드 API 1 — dist째 zip 201 + 언랩 루트 서빙 확인), `npm run test:e2e` 1 passed(4.1s) 회귀 없음.
- 다음 할 일: 실사용 1회(팀 내 실제 목업으로 기획서 1부) 후 "목업 팀 도움 없이 가능했는가" 판정을 킥오프 스펙 §11에 기록 → S2 계획 입력. 선택: CI 파이프라인.
- 막힌 지점: 없음.

### 2026-07-09 — T10 Playwright E2E 완료 (S1 WBS 전 항목 종료)
- 브랜치: `feat/e2e-playwright-t10` → `main` 병합 완료(2026-07-09, fast-forward, 병합 후 vitest 68 passed 재확인).
- 완료: **fixtures/todo-app** (ID-12) — Vite + vanilla TS SPA, 외부 런타임 의존성 0, 라우트 2개(`/` 할 일 목록: 입력창·추가·항목별 완료/삭제, `/stats` 통계: 필터 버튼 2개), history 라우팅(SPA fallback 검증), 부착 대상 4+, 상태 따라 텍스트 바뀌는 요소(`#todo-count`). npm workspace로 편입, `npm run fixtures:zip`이 빌드 후 `fixtures/todo-app.zip`(5KB, gitignore) 생성.
- 완료: **Playwright E2E 1본** — `e2e/s1-dod.spec.ts`가 §9.1 시나리오 그대로: 콘솔 UI로 zip 업로드 → 편집 화면(shadow DOM은 Playwright가 관통)에서 장면 2개 등록(등록 즉시 동결 배지 2개 확인)·어노테이션 각 2개 부착·설명 입력·저장됨 확인 → 콘솔에서 export 다운로드 → **새 브라우저 컨텍스트에서 file:// 오픈** 후 검증: 장면 2개 전환 왕복, 마커 4개가 대상 요소 우상단(오차 ≤2px, is-uncertain 0), 설명 텍스트 일치, 마커↔목록 상호 하이라이트, **네트워크 요청 = 문서 file:// 1건뿐(외부 0건)**.
- 완료: 설정 — `playwright.config.ts`(webServer가 dist 서버를 PORT 4123·전용 data dir로 기동, globalSetup이 매 실행 초기화), 루트 `test:e2e` 스크립트(빌드→fixtures zip→playwright). vitest include는 `packages/**`라 e2e와 상호 간섭 없음.
- 검증: `npm run test:e2e` **1 passed (4.4s)** — 첫 실행 통과. `npm test` 68 passed·`npm run typecheck` exit 0 회귀 없음.
- 다음 할 일: **S1 WBS 종료.** 실사용 1회(팀 내 실제 목업으로 기획서 1부) 후 "목업 팀 도움 없이 가능했는가" 판정을 킥오프 스펙 §11에 기록 → S2 계획 입력 (§9.1). 선택: CI 파이프라인(현재 로컬 실행만).
- 막힌 지점: 없음. 참고: Playwright Chromium은 로컬 캐시(~94MB) 설치 필요 — `npx playwright install chromium`.

### 2026-07-09 — 편집기 포커스 강탈 + viewer 마커 결함 2건 픽스
- 브랜치: `fix/editor-focus-viewer-markers` (`feat/console-page-t9` 위에 스택) → `main` 병합 완료(2026-07-09, T9 → fix 순서 fast-forward).
- 완료: **SDK 포커스 강탈 픽스** — `App.tsx` title 자동 포커스 useEffect 의존성에서 `doc` 제거(`[selectedAnn]`만). doc이 있으면 편집 키스트로크마다 effect가 재실행되어 description 입력 포커스를 title이 강탈했음.
- 완료: **viewer resize 리스너 누적 픽스** — `renderStage`가 장면 전환마다 `window.resize` 리스너를 새로 달던 것을, `renderViewer`의 단일 리스너 + 현재 장면 콜백(`markerRefresh.current`) 교체 방식으로 변경. 스냅샷 없는 장면 진입 시 stale 콜백도 무효화.
- 완료: **viewer 목록→마커 스크롤** — `syncActive`가 어노테이션 목록 항목에 더해 마커도 `scrollIntoView`(양방향 상호 하이라이트·스크롤, detailed-spec §4.1 충족).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` 68 passed. **실 Chrome 검증(포커스)**: 기존 어노테이션 description에 긴 문장 타이핑 — 디바운스 저장 여러 번을 지나도 문장 전체가 description에 유지 + `shadow.activeElement === textarea` 확인(수정 전엔 첫 재렌더에 title로 유출). viewer 수정은 export 산출물 인라인 반영 확인(단일 리스너 코드·마커 scrollIntoView 포함), 라이브 resize/스크롤 동작은 T10 E2E에서 함께 커버 예정.
- 다음 할 일: T10 — Playwright E2E(S1 DoD, technical-spec §9.1). fixtures는 ID-12(의존성 0 Todo SPA, 라우트 2, 부착 대상 4+).
- 막힌 지점: 없음.

### 2026-07-09 — T9 콘솔 페이지 완료 + T7·T8 품질 검토
- 브랜치: `feat/console-page-t9` → `main` 병합 완료(2026-07-09).
- 완료: **콘솔 페이지**(detailed-spec §2) — `routes/console.ts`에 정적 HTML 1장(프레임워크 없음, 인라인 CSS/JS, export.ts의 VIEWER_CSS 선례를 따라 TS 문자열로 관리). 새 프로젝트 폼(이름·zip·안내 문구), 프로젝트 목록(장면·어노테이션 수, 수정일, 편집 열기/내보내기/삭제), 업로드 성공 시 제외 집계 표시 + 편집 링크. 편집 URL은 `location.host` 기준 서브도메인 조립(ID-01). export는 스냅샷 없는 장면 N개 확인 다이얼로그 후 진행, 50MB 경고 헤더 표시, `Content-Disposition filename*` 파싱으로 파일명 유지. 삭제는 확인 다이얼로그 1회.
- 완료: **업로드 검증 보강**(§2.2·§6 — 스펙에 있었으나 T2에서 누락) — 해제 후 루트 index.html 없으면 400 거부("빌드 산출물 루트에 index.html이 필요합니다"), zip 아님/해제 실패는 400("zip 파일을 확인해주세요"), 모든 거부 경로에서 생성된 빈 프로젝트 정리(기존엔 zip-slip 거부 시 잔존).
- 완료: **T7·T8 산출물 품질 검토** — T7 스펙 부합(ID-05·§3.8·§6.2 확인). T8 스펙 부합하나 경미 결함: (1) viewer 장면 전환마다 resize 리스너 누적(`viewer/main.ts:433`), (2) 목록→마커 방향 스크롤 미구현(§4.1). 미수정 — fix 브랜치 대상.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **68 passed**(+6: 콘솔 서빙 3, 업로드 검증 3). **실 Chrome 검증**: 콘솔 접속→폼 submit 핸들러로 zip 업로드(제외 집계·편집 링크 표시)→목록 갱신(장면 0·어노테이션 0)→편집 열기 새 탭(SDK 주입)→장면 등록 즉시 동결→어노테이션 1개→콘솔 목록에 장면 1·어노테이션 1 반영→내보내기로 `order-mockup.html` 다운로드(23.5KB, script 3개=spec-data·snapshot·viewer, 외부 URL 참조 0). file:// 오픈은 T8에서 검증된 뷰어 그대로라 생략(자동화 환경이 http→file 이동 차단).
- **실버그 발견(브라우저 검증이 잡음, 미수정)**: `App.tsx:281` — title 자동 포커스 useEffect 의존성에 `doc`이 포함되어, 설명(textarea) 입력의 매 키스트로크마다 title input으로 포커스 강탈(입력 내용이 title로 새어 들어감). T5 검증 때 title만 타이핑해 미노출. 수정은 의존성을 `[selectedAnn]`으로 축소 — **다음 fix 브랜치에서 처리**(`fix/ann-title-focus-steal` 제안).
- 다음 할 일: (1) `fix/ann-title-focus-steal` — 위 포커스 버그 + T8 경미 결함 2건 처리 여부 결정. (2) T10 — Playwright E2E(S1 DoD 시나리오, technical-spec §9.1). fixtures는 ID-12(의존성 0 Todo SPA, 라우트 2, 부착 대상 4+).
- 막힌 지점: 없음. 참고: 검증 중 생성된 `~/Downloads/order-mockup.html`은 테스트 산출물.

### 2026-07-07 — T8 뷰어 + export 조립 완료
- 브랜치: `feat/viewer-export-t8` → `main` 병합 완료(fast-forward, 2026-07-09 확인 — 병합 직후 이 로그를 갱신하지 못해 뒤늦게 반영).
- 완료: **서버 export API** — `POST /api/projects/:id/export`가 저장된 `SpecProject`와 scene `snapshotAsset`들을 읽어 단일 HTML로 조립. spec JSON은 `application/json#spec-data`에 안전 이스케이프, 스냅샷은 scene별 base64 `text/plain[data-snapshot]`으로 인라인, `packages/viewer/dist/main.js`를 inline module로 삽입. 한글 파일명은 `filename*`로 보존하고 ASCII `filename` fallback을 둠. 50MB 초과 산출물은 `X-Mockspec-Warning: EXPORT_TOO_LARGE` 헤더로 경고하며 진행.
- 완료: **vanilla viewer** — 장면 사이드바(order 순), 중앙 `iframe sandbox="allow-same-origin" srcdoc` 스냅샷, 앵커 재해석(selector→text/attrs refind→rect fallback) 마커, 우측 어노테이션 패널, 마커↔목록 상호 하이라이트, 스냅샷 없는 장면 placeholder, description HTML escape 후 제한적 markdown 렌더.
- 완료: **회귀 테스트** — export API 3개 + HTML 이스케이프 1개, viewer helper/anchor 5개 추가.
- 검증: `npm run typecheck` exit 0, `npm run build` exit 0(sdk.js 836.89KB/gzip 256.06KB, 기존 single-file-core `import.meta` IIFE 경고만 발생), `npm test` **62 passed**(권한 밖 실행 — 샌드박스 내부는 Supertest listen EPERM), 마지막 viewer selector escape 조정 후 `npx vitest run packages/viewer/src/main.test.ts` **5 passed**. Chrome DevTools로 `/private/tmp/mockspec-t8-export.html`을 `file://` 오픈해 title/scene/panel/마커 1개/iframe 스냅샷 확인, 콘솔 오류 0, 네트워크는 HTML 파일 자체 로드 1건뿐(외부 서브리소스 요청 0).
- 다음 할 일: T9 — 콘솔 정적 페이지. 루트 `/`에서 프로젝트 목록·zip 업로드·편집 열기·export 버튼을 제공하고, 스냅샷 없는 장면 경고 후 다운로드를 트리거. detailed-spec §2 참조.
- 막힌 지점: 없음. 참고: DevTools 탭 닫기 시 도구 사용량 제한으로 close 요청이 거부되어 탭은 그대로 남아 있을 수 있음.

### 2026-07-07 — T7 SDK 저장 + 오프라인 큐 완료
- 브랜치: `feat/sdk-save-offline-queue-t7` → `main` 병합 완료.
- 완료: **SDK 초기 로드** — `fetchProject`로 서버 `SpecProject`를 읽고, `mockspec:pending:{projectId}`가 있으면 ID-05에 따라 로컬본을 우선 표시한 뒤 묻지 않고 PUT 재전송. 성공 시 큐 삭제, 실패 시 오프라인 상태 유지.
- 완료: **저장 흐름** — `EditorDoc` ↔ `SpecProject` 변환(`docFromProject`, `applyDocToProject`)과 `updatedAt` 제외 시그니처(`projectContentSignature`)를 추가해 서버가 `updatedAt`만 바꿔도 저장 루프가 생기지 않게 함. 편집 변경은 500ms 디바운스로 전체 문서 PUT.
- 완료: **오프라인 큐** — `saveProjectWithQueue`가 PUT 실패(네트워크·HTTP)를 최신 `SpecProject` 1개로 localStorage에 저장. `online` 이벤트 재전송에 더해, 로컬 서버 재기동처럼 브라우저 online 상태가 변하지 않는 경우도 자동 반영되도록 오프라인 상태에서 2초 간격 pending 재전송을 추가.
- 완료: **패널 저장 상태 표시** — 상단에 `저장됨 ✓` / `저장 중…` / `오프라인 — 로컬 보관 중` / 로딩·불러오기 실패 상태 표시. 프로젝트 로드 전에는 장면 등록 버튼 비활성.
- 검증: `npm run typecheck` exit 0, `npm run build` exit 0(sdk.js 836.89KB/gzip 256.06KB, 기존 single-file-core `import.meta` IIFE 경고만 발생), `npm test` **53 passed**(권한 밖 실행 — 샌드박스 내부는 Supertest listen EPERM). 신규 테스트: API 큐 7개, 상태 변환 2개, App 저장/재전송 1개(요소 클릭→어노테이션 생성→첫 PUT 실패→localStorage pending 생성→2초 재시도 성공→큐 삭제).
- 다음 할 일: T8 — viewer 패키지 구현 + server export 조립. 저장된 `SpecProject`와 `snapshotAsset`들을 읽어 단일 HTML에 spec JSON + 스냅샷 + vanilla viewer를 인라인하고, `file://` 네트워크 0건을 검증. technical-spec §8·output-standard.md 참조.
- 막힌 지점: 없음. 참고: T7은 자동 테스트로 저장/큐/재전송을 검증했지만 실 Chrome 수동 스모크는 수행하지 않음.

### 2026-07-07 — T6 SDK 장면 등록 + 동결 완료
- 브랜치: `feat/sdk-scene-freeze-t6` → `main` 병합 완료.
- 완료: **동결 모듈** `freeze/freeze.ts`(single-file-core를 클라이언트에서 실행 — 서버 헤드리스 재현 금지 결정의 구현). 진입점 `getPageData(opts, {})`. `freeze/verify.ts`로 `<script>` 0개 검증기를 **분리**(single-file-core를 로드하지 않는 순수 모듈 → node/happy-dom 유닛 테스트 가능). 검증은 **모든 `<script>` 태그 0개 엄격**(ld+json 등 비실행 데이터도 실패 처리 — 뷰어 srcdoc 무해화 제1 방어선).
- 완료: **동결 옵션**(§5) — `blockScripts:true`(모든 script 제거), `removedElementsSelector:"[data-mockspec-root]"`(SDK 자신 제외), `saveFilenameTemplateData:false`(동결 후 옵션 JSON `<script>` 재삽입 방지), CSS 인라인·이미지/폰트 data URI화·미사용 스타일 제거는 single-file 기본. `<html>`의 패널 margin-right는 동결 중 임시 제거(원본 레이아웃 보존).
- 완료: **API 클라이언트** `api.ts` — `uploadSnapshot`(`POST /__mockspec/api/projects/:id/assets`, field `snapshot`, 상대 경로만). **상태** `state.ts::setSceneSnapshot`(snapshotAsset·frozenAt 기록). **App.tsx** — 장면 등록 **직후 자동 동결**(`void runFreeze`), 각 장면 **재동결 버튼(⟳)**, 스피너/`✓ 동결됨 {시각}`/**"동결 실패 — 재시도" 배지**(클릭 시 재동결) UX(§3.7).
- 검증: `npm run build` exit 0(sdk.js 833KB/gzip 255KB — single-file-core 정적 번들 포함, 사용자 승인), `npm test` **43 passed**(freeze verify 5개 신규). **실 Chrome 검증**: 예약관리 샘플(외부 CSS+SVG+인라인 script) 업로드→장면 등록 즉시 동결 성공→스냅샷 asset 업로드(1572B)→**`<script>` 0개**·`<link stylesheet>` 0개(→inline `<style>` 1개)·`data:image/svg` 인라인·`data-mockspec-root` 0개(제외됨)·본문 텍스트 보존 확인→**스냅샷 단독 오픈 시 원본과 시각적 동일**(스크린샷).
- **실버그 발견·수정(브라우저 검증이 잡음)**: single-file의 프레임 캡처가 `chrome.runtime.sendMessage`(확장 전용 API)를 호출해, 페이지 주입 SDK에서 **무한 대기**(동결 스피너 고착). `removeFrames:true`로 프레임 처리 경로를 차단해 해결(S1 목업은 단일 페이지라 iframe 캡처 불필요).
- 다음 할 일: T7 — 저장·오프라인 큐. `api.ts`에 전체 spec PUT(500ms 디바운스)·`localStorage["mockspec:pending:{id}"]` 최신본 1개 적재·online/재마운트 재전송(ID-05 로컬 우선). 편집 상태(현재 인메모리 EditorDoc)를 SpecProject로 승격해 서버와 왕복. **재동결/장면 삭제 시 이전 asset 정리(ID-11)는 서버 replaceSpec이 담당 — T7의 PUT이 트리거**(현재 T6 단독에선 재동결 시 이전 asset이 디스크에 남음). technical-spec §6.2 참조.
- 막힌 지점: 없음. 참고 2건: (1) sdk.js가 18.6KB→833KB로 커짐(single-file-core의 css-tree·zip 포함) — 편집기 SDK라 산출물엔 무영향, 초기 로딩만 무거움. (2) 빌드 시 `import.meta.url`(zip.js 압축-워커 경로) 경고는 **dead code**(우리는 `compressContent` 미사용) — 무해. **동결 실패 배지 경로는 코드·유닛만 확인, 라이브 미유발**(정상 케이스만 실브라우저로 확인).

### 2026-07-07 — T5 SDK 어노테이션·앵커·마커 완료
- 브랜치: `feat/sdk-annotation-anchor-t5` (main 미병합, 동의 대기).
- 완료: **앵커 알고리즘** `anchor/anchor.ts`(sdk·viewer 공유용 순수 함수) — `pickTarget`(ID-08 인터랙티브 조상), `generateAnchor`/`generateSelector`(ID-06 유일 id 기준점 + nth-of-type 체인, 클래스 미사용, text/attrs 시그니처, 문서 기준 rect), `resolveAnchor`(ID-07 selector→시그니처 검증→재탐색+selector 자동 갱신→rect fallback).
- 완료: **편집 상태** `state.ts`(인메모리 EditorDoc — 장면·어노테이션 CRUD, SCR-### 코드, 장면 내 번호 단조 증가·삭제 시 재부여 금지). **부착 시퀀스** App.tsx(편집 모드 클릭 차단 지점에서 pickTarget→generateAnchor→addAnnotation→title 포커스). **마커 오버레이** `useMarkers.ts`(현재 장면 소속만 렌더 ID-09, 요소 우상단, MutationObserver+ResizeObserver 300ms 디바운스+scroll/resize 즉시 재해석, rect fallback은 점선 "위치 불확실").
- 완료: 장면 등록 버튼([+ 현재 화면을 장면으로], 동결 없이 그릇만 — 동결은 T6), 장면 목록·선택(=현재 장면), 어노테이션 title/description 편집·삭제.
- 검증: `npm run build` exit 0, `npm test` 38 passed(앵커 유닛 9개 신규 — happy-dom). **실 Chrome 검증**: 편집 모드 요소 클릭→어노테이션 생성+마커 정확 위치(요소 우상단)→목업 클릭 차단→**selector 깨뜨려도 text/attrs 재탐색으로 마커가 올바른 요소 추적(168→98)**→대상 제거 시 "위치 불확실" 마커 유지(사라지지 않음)→콘솔 에러 0.
- **버그 발견·수정(브라우저 검증이 잡음)**: useMarkers가 `[sceneId,active]`만 의존해, 패널에서 추가한 어노테이션(목업 DOM 미변경 + shadow tree라 MutationObserver 미포착)이 마커로 안 떴음. 현재 장면 어노테이션 시그니처(id+selector)를 의존성에 추가해 해결.
- 다음 할 일: T6 — 장면 등록 시 즉시 동결(`single-file-core` 번들, 클라이언트 실행), 스냅샷 `POST /assets` 업로드→`snapshotAsset` 기록, `<script>` 0개 검증, 동결 실패 시 배지+재시도(§3.7), 재동결 버튼. `data-mockspec-root`는 이미 동결 제외 마킹됨. technical-spec §5·킥오프 §7 참조.
- 막힌 지점: 없음. 참고: 물리적 마우스 클릭이 새로고침 직후 간헐적으로 shadow FAB에 안 먹는 도구측 이슈 있음 — 검증은 실제 이벤트 핸들러를 타는 DOM click 디스패치로 우회(핸들러·렌더 경로는 그대로 검증됨).

### 2026-07-07 — T4 SDK 셸(FAB·패널·모드 전환) 완료
- 브랜치: `feat/sdk-shell-t4` (main 미병합, 동의 대기).
- 완료: SDK를 Preact + Shadow DOM으로 구현. `main.tsx`(Shadow 호스트 생성, `data-mockspec-root` 마킹=동결 제외, currentScript에서 projectId), `ui/App.tsx`(FAB→360px 패널 도킹+documentElement margin-right, 미리보기/편집 토글, Alt+Shift+E, 편집 모드 capture 클릭 차단+요소 하이라이트), `styles.ts`(CSS를 코드 내 문자열로 → 단일 파일 보장).
- 완료: 빌드 파이프라인 분리 — sdk는 tsc -b 그래프에서 제외하고 `tsc --noEmit`(타입체크)+`vite build`(IIFE 번들). 루트 `build`=`tsc -b && npm run build -w @mockspec/sdk`. 산출물 `packages/sdk/dist/sdk.js` 단일 IIFE 18.6KB(gzip 7.75KB), 외부 import 0.
- 완료: 서버가 실제 번들 서빙 — `sdkBundle.ts`(env override→`@mockspec/sdk/dist/sdk.js`→플레이스홀더 폴백), `serve.ts`의 `/__mockspec/sdk.js`가 이를 사용. server가 `@mockspec/sdk` 워크스페이스 의존(경로 해석용).
- 검증: `npm run build` exit 0, `npm test` 29 passed. **실 Chrome 검증**(서버 기동+샘플 업로드+브라우저 자동화): FAB 표시→클릭 시 패널 도킹(margin 360px)→Shadow DOM 격리(라이트 DOM 유출 0)→편집 모드에서 목업 "추가" 클릭 **차단**(로그 불변)→미리보기 전환 후 클릭 **정상 동작**(로그 갱신)→콘솔 에러 0.
- **관찰 항목 해소**: 서브도메인 언더스코어 라벨(`prj_...localhost`)을 Chrome이 정상 해석함을 실제 확인. id 포맷 변경 불필요.
- 다음 할 일: T5 — 어노테이션 부착 시퀀스(편집 모드 클릭→앵커 생성→번호 부여→마커 렌더), 앵커 생성/재해석 알고리즘(technical-spec §4, ID-06/07/08). App.tsx의 클릭 차단 지점(현재 no-op)에 어노테이션 생성을 얹고, `anchor/` 모듈 신설(viewer와 공유 예정). 마커 오버레이는 Shadow DOM에 렌더.
- 막힌 지점: 없음.

### 2026-07-07 — T3 Spec API + 파일 저장 완료
- 브랜치: `feat/spec-api-store-t3` (main 미병합, 동의 대기).
- 완료: `routes/projects.ts`에 GET/PUT/DELETE `/projects/:id`, POST/GET `/projects/:id/assets` 추가. PUT은 문서 전체 교체 + `version`(=1)·`id` 검증(불일치 400), updatedAt은 서버 시각으로 갱신.
- 완료: `store/projectStore.ts` 확장 — `replaceSpec`(전체 교체 + **미참조 asset 즉시 삭제로 ID-11 구현**, 별도 GC 없음), `deleteProject`, `saveAsset`/`readAsset`/`deleteAsset`(asset 키 형식 검증으로 경로 이탈 차단). asset 50MB 제한(multer).
- 완료: export(POST /:id/export)는 **T8로 미룸** — 뷰어 번들 의존. 의도적 범위 제외.
- 검증: `npm run build` exit 0, `npm test` 27 passed. PUT 왕복 무손실(updatedAt만 서버 갱신, anchor.rect까지 완전 일치), ID-11(장면이 참조 놓으면 asset 즉시 삭제), 경로 이탈 차단 모두 supertest 통합으로 실 HTTP 검증.
- 다음 할 일: T4 — SDK(Preact + Shadow DOM). FAB·우측 패널·편집/미리보기 모드 전환. Vite lib mode로 `dist/sdk.js`(IIFE 1파일) 빌드, 서버 serve.ts의 SDK_PLACEHOLDER를 이 번들로 교체. **T4 브라우저 로딩 시 서브도메인 언더스코어 라벨(관찰 항목) 실동작 확인.** technical-spec §1.3·킥오프 §6 참조.
- 막힌 지점: 없음.

### 2026-07-07 — T2 서버(업로드·해제·서빙·주입) 완료
- 브랜치: `feat/server-serve-inject-t2` (main 미병합, 동의 대기).
- 완료: Host 헤더 분기(`host.ts` — 서브도메인=목업, 루트=콘솔/API, 오리진 하드코딩 없음).
- 완료: 업로드/해제 — `routes/projects.ts`(multer 200MB, memoryStorage) + `unzip/extract.ts`(unzipper Open.buffer). **zip-slip 방지**(정규화 후 destDir prefix 검증, 이탈 시 zip 전체 거부) + **제외 필터**(node_modules/·.git/·__MACOSX/·.DS_Store·Thumbs.db·*.map, `{pattern,count}[]` 집계를 업로드 응답에 포함).
- 완료: 정적 서빙 + SDK 주입 — `routes/serve.ts`(경로 정규화로 서빙 단계 traversal 방지, text/html에만 `</body>` 직전 주입, 디렉토리→index.html, 확장자 없는 404→SPA fallback) + `inject.ts`. 예약 경로 `/__mockspec/sdk.js`는 **T4 전까지 플레이스홀더 JS** 서빙.
- 완료: same-origin API 배선 — 서브도메인의 `/__mockspec/api/*`와 루트의 `/api/*`가 동일 라우터(`app.ts`, CORS 없음). 저장소 `store/projectStore.ts`(spec.json 생성/읽기/목록) + `store/paths.ts`(env `MOCKSPEC_DATA_DIR` 지연평가) + `ids.ts`(소문자 영숫자 nanoid — 서브도메인 케이스 폴딩 회피) + `errors.ts`(ID-10 표준).
- 검증: `npm run build` exit 0, `npm test` 20 passed(extract/host/inject/app/shared). 실기동: 서버 띄워 curl로 업로드→서브도메인 주입→SPA fallback→sdk.js→node_modules 디스크 제외까지 확인.
- 다음 할 일: T3 — Spec API 나머지(GET/PUT/DELETE `/projects/:id`, assets POST/GET). PUT은 문서 전체 교체(version·id 불일치 400), 저장 왕복 무손실 vitest. `projectsRouter`에 라우트 추가하고 `projectStore`에 saveSpec/delete/asset I/O 확장. technical-spec §6 참조.
- 막힌 지점: 없음. **관찰 항목**: 프로젝트 id의 `prj_` 접두 언더스코어가 서브도메인 라벨에 포함됨(`prj_x.localhost`). Node http/테스트는 무관하나 실제 Chrome/Edge에서 *.localhost 언더스코어 라벨 해석은 T4 브라우저 로딩 시 확인 필요 — 문제 시 결정 변경 절차(킥오프 §11)로 id 포맷 조정.

### 2026-07-07 — T1 모노레포 셋업 완료
- 브랜치: `chore/monorepo-setup-t1` (main 미병합, 동의 대기).
- 완료: npm workspaces 모노레포 구성. 루트 `package.json`(workspaces 4개)·`tsconfig.base.json`(strict, composite)·`tsconfig.json`(project references)·`vitest.config.ts`.
- 완료: `packages/shared` — `src/types.ts`(SpecProject/Scene/Annotation/Anchor/Rect 계약), `src/constants.ts`(WORKING_NAME 등 워킹네임 단일 관리), `src/index.ts` 배럴. TS project reference로 3패키지가 `@mockspec/shared`를 import.
- 완료: `packages/sdk`·`server`·`viewer` 스켈레톤 — 각각 shared 타입을 실제 import (sdk: SpecProject+PROJECT_DATA_ATTR, server: SpecProject+WORKING_NAME, viewer: Scene+Annotation). 본체 로직은 각 T에서.
- 검증: `npm run build`(tsc -b) exit 0, `npm test`(vitest) 2 passed, `npm audit` 0 vulnerabilities(vitest 4로 상향). 테스트 파일은 tsconfig exclude로 dist에서 제외.
- 다음 할 일: T2 — `server/routes/serve.ts`(서브도메인 라우팅+SDK 주입), 업로드·unzipper 해제(zip-slip 방지·제외 필터), 정적 서빙. technical-spec §3 참조.
- 막힌 지점: 없음. (T1 브랜치 main 병합 여부만 사용자 확인 대기)

### 2026-07-07 — 문서 체계 확정, 핸드오프 구조 도입
- 완료: `docs/PRD.md`, `docs/detailed-spec.md`, `docs/technical-spec.md`, `docs/output-standard.md`, `docs/implementation-decisions.md`(ID-01~15) 작성. 미정의 지점 15건을 "단순하고 범용적일 것" 기준으로 확정.
- 완료: `guide/s1-kickoff-spec.md` §11에 2차 개정 기록 (rect 좌표 기준, same-origin API, 데이터 모델 카운터 필드).
- 완료: `AGENTS.md`, `CLAUDE.md`, 본 `docs/PROGRESS.md` 신설 — 세션·에이전트가 바뀌어도 이어서 작업할 수 있도록 핸드오프 구조 확립.
- 다음 할 일: T1(모노레포 셋업)부터 구현 착수.
- 막힌 지점: 없음.
