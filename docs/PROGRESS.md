# PROGRESS — 작업 진행 로그

> 이 파일은 여러 에이전트·여러 세션에 걸친 작업 인수인계의 단일 진실 공급원이다.
> Claude Code의 개인 메모리(`~/.claude/projects/.../memory/`)는 세션·머신·에이전트 종류가
> 바뀌면 접근할 수 없다. 이 프로젝트에 관한 진행 상태·결정·다음 할 일은
> 전부 이 파일(과 `docs/`의 스펙 문서)에 남긴다. 개인 메모리에는 남기지 않는다.
>
> 갱신 규약은 [AGENTS.md](../AGENTS.md) §3 참조.

## 현재 단계

**T8 완료(빌드·테스트·file:// 스모크 통과). 다음은 T9(콘솔 페이지).**

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
- [ ] T9 콘솔 페이지 (업로드→편집 열기→export가 콘솔만으로 가능)
- [ ] T10 E2E (Playwright) — S1 Definition of Done 시나리오 자동화

## 세션 로그 (최신이 위)

### 2026-07-07 — T8 뷰어 + export 조립 완료
- 브랜치: `feat/viewer-export-t8` (main 미병합, 동의 대기).
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
