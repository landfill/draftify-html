# PROGRESS — 작업 진행 로그

> 이 파일은 여러 에이전트·여러 세션에 걸친 작업 인수인계의 단일 진실 공급원이다.
> Claude Code의 개인 메모리(`~/.claude/projects/.../memory/`)는 세션·머신·에이전트 종류가
> 바뀌면 접근할 수 없다. 이 프로젝트에 관한 진행 상태·결정·다음 할 일은
> 전부 이 파일(과 `docs/`의 스펙 문서)에 남긴다. 개인 메모리에는 남기지 않는다.
>
> 갱신 규약은 [AGENTS.md](../AGENTS.md) §3 참조.

## 현재 단계

**T4 완료(빌드·테스트·실브라우저 검증 통과). 다음은 T5(SDK: 어노테이션·앵커·마커).**
T4는 `feat/sdk-shell-t4` 브랜치 — main 병합은 사용자 동의 대기 중.

## WBS 체크리스트

원본: `technical-spec.md` §9.2 / `guide/s1-kickoff-spec.md` §10. 두 원본을 고치면 이 표도 같이 갱신한다.

- [x] T1 모노레포 셋업 + shared 타입 (`packages/shared/src/types.ts`가 3패키지에서 import됨) — `npm run build` exit 0, `npm test` 2 passed
- [x] T2 서버: 업로드·해제·정적 서빙·SDK 주입 (zip 업로드 → 서브도메인에서 목업 열림, zip-slip 테스트 통과) — vitest 20 passed, 실기동 curl 스모크 통과
- [x] T3 Spec API + 파일 저장 (전체 엔드포인트 vitest, 왕복 무손실) — vitest 27 passed, PUT 왕복 무손실·ID-11 asset 정리 검증
- [x] T4 SDK: FAB·패널·모드 전환 (Shadow DOM 격리) — Vite IIFE 단일 sdk.js(18.6KB), 실 Chrome에서 FAB·도킹·모드·격리·클릭차단 검증
- [ ] T5 SDK: 어노테이션·앵커·마커 (재탐색 성공 1케이스 포함)
- [ ] T6 SDK: 장면 등록 + 동결 (단독 오픈 시 시각적 동일 + `<script>` 0개)
- [ ] T7 SDK: 저장·오프라인 큐 (서버 중단 후 재기동 시 자동 반영)
- [ ] T8 뷰어 + export 조립 (산출물 HTML이 file://로 열림)
- [ ] T9 콘솔 페이지 (업로드→편집 열기→export가 콘솔만으로 가능)
- [ ] T10 E2E (Playwright) — S1 Definition of Done 시나리오 자동화

## 세션 로그 (최신이 위)

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
