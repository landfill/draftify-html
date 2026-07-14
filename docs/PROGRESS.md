# PROGRESS — 작업 진행 로그

> 이 파일은 여러 에이전트·여러 세션에 걸친 작업 인수인계의 단일 진실 공급원이다.
> Claude Code의 개인 메모리(`~/.claude/projects/.../memory/`)는 세션·머신·에이전트 종류가
> 바뀌면 접근할 수 없다. 이 프로젝트에 관한 진행 상태·결정·다음 할 일은
> 전부 이 파일(과 `docs/`의 스펙 문서)에 남긴다. 개인 메모리에는 남기지 않는다.
>
> 갱신 규약은 [AGENTS.md](../AGENTS.md) §3 참조.

## 현재 단계

**S2 구현 완료 (2026-07-11) — T11~T18 전 항목 완료. 원격 저장소(github.com/landfill/draftify-html) 개설·CI green.**
**S2.5(경로 D — 브라우저 확장 클라이언트 주입) 완료 (2026-07-12) — T19~T25 전부 완료, 실사용 판정 "가능". 실사용 10건 피드백 반영.**
**다중 장면 전이 + 흐름도(T26~T28) + 실사용 fix 11~13차 + 사용 가이드 — PR #1로 main 병합 완료 (2026-07-12).**
**용어 개정(표면 "장면"→"화면"·"전이"→"화면 이동", 킥오프 §11 10차) — PR #2로 main 병합 완료 (2026-07-12, CI green·rebase).**
**뷰어 세로 스크롤 내부화(3컬럼 각자 스크롤, 사용자 채택) — PR #3로 main 병합 완료 (2026-07-14, rebase·CI green·리뷰 1건(E2E 서브픽셀 1px 허용) 반영·브랜치 삭제).**
**작성자 라벨 + 산출물 이력(T29, FR-CON-03·FR-EXP-08) — PR #4로 main 병합 완료 (2026-07-14, rebase·CI green·리뷰 3건 반영·브랜치 삭제).**
**동결 크기 절감(킥오프 §11 11차) — 폰트 항상 차단(blockFonts)·비디오/오디오/포스터 콘텐츠 미임베드(blockVideos + neutralizeMedia). PR #5로 main 병합 완료 (2026-07-14, rebase·CI green·리뷰 1건(neutralizeMedia shadow DOM 재귀) 반영·브랜치 삭제).**
**어노테이션 끝 번호 재사용(킥오프 §11 12차) — `fix/annotation-trailing-number-reuse`, Draft PR #6 열림. 중간 결번 유지 + 신규는 현재 최대 번호+1. 로컬 검증·CI green.**

## 작성자 라벨·산출물 이력 WBS 체크리스트 (technical-spec §9.2, 2026-07-14 착수)

- [x] T29 `ownerLabel` 승격 + 산출물 이력(메타 전용, §6.3) — vitest 176 passed(+7)·E2E 4본 통과. 실 서버 구동 검증: 라벨 생성(공백 정리)→export 2회→목록 요약 "내보내기 2회"·뷰어 헤더 "작성자 김기획"·삭제 confirm에 이름·산출물 임베드 spec에 ownerLabel. 이력은 `exports.json`(서버 소유, spec.json 밖)에 메타만. htmlRef(파일 보관)·members[]는 미채택/보류 — technical-spec §2.2

## 전이·흐름도 WBS 체크리스트 (technical-spec §9.2, 2026-07-12 착수)

- [x] T26 shared: `Annotation.transition { toSceneId, condition? }` 승격 — vitest 왕복 무손실·필드 부재 하위 호환 검증
- [x] T27 SDK: 전이 지정 UI (장면 드롭다운(다른 장면만)+조건 텍스트) + 대상 장면 삭제 시 transition 제거 — vitest UI 왕복·정리 검증, focusShield SELECT 보호
- [x] T28 뷰어·산출물: 전이 링크(클릭 시 장면 전환) + 프로세스 흐름도(자체 SVG, 전이 없으면 생략) + E2E — vitest 160·E2E 4본 통과, 실 Chromium 분기+순환 그래프 시각 확인

## S2.5 WBS 체크리스트 (pathD 킥오프 §7)

- [x] T19 데이터 모델 + 토큰 발급/검증 (`snippet` 변형·해시 저장) — vitest 120 passed(+7), 평문 미보관·재발급 무효·왕복 무손실 검증
- [x] T20 저장 경로 토큰 인증 (경로 D 프로젝트 401 게이트) — vitest 126 passed(+6), PUT/assets/export 게이트·타 프로젝트 토큰 거부·기존 경로 무영향 검증
- [x] T21 콘솔 온보딩 3번째 선택지 (토큰·설치 안내) — vitest 132 passed(+6), snippet 등록·토큰 재발급/폐기 API·콘솔 3택 검증, 실 Chrome 렌더 확인
- [x] T22 확장 스캐폴드 + content script SDK 주입 (+팝업 바인딩 선행) — 실 Chromium unpacked 로드로 FAB·패널·미바인딩 미주입 검증
- [x] T23 background 저장 릴레이 (팝업 바인딩은 T22 선행) — 실 Chromium에서 장면 등록→동결→업로드→PUT 저장 전 과정 + lastSeenOrigin 스탬프 검증
- [x] T24 E2E: 로그인 뒤 화면 시나리오 (DoD) — `e2e/pathD-dod.spec.ts`, 확장 로드+로그인+편집+마스킹+export+오프라인 검증, 3본(S1·S2·경로 D) 통과
- [x] T25 실사용 판정 "가능" — 사용자가 실제 HANATOUR(Nexacro) 로그인 화면에 확장 연결→편집→저장→export→뷰어까지 완주. 실사용 10건 피드백 반영(ID 표시·연결 코드·동결 폴백·blockFonts·포커스 5~8차(Nexacro mousedown/pointerdown)·뷰어 넓은 화면 스크롤·네비 접기). 한계: 폴백 페이지는 폰트 시스템 대체.

## S2 WBS 체크리스트 (킥오프 스펙 §8 — 구현은 docs/ 동기화 후 시작)

- [x] T11 shared 타입 확장 (mockupSource union·maskingRules·maskedSnapshotAsset) — vitest 84 passed, S1 형태 하위 호환·S2 필드 왕복 무손실·마스킹본 ID-11 검증
- [x] T12 SSRF 가드 모듈 (allowlist·hard-deny IP·IP 고정 연결) — vitest 103 passed(+19), lookup 훅이 node:http에서 루프백 연결 차단 실측
- [x] T13 프록시 코어 + SDK 주입 (CSP/XFO 제거, 리다이렉트 정책) — vitest 110 passed(+7), 실 업스트림 프록시 왕복·IP 리터럴 갭 차단 검증
- [x] T14 쿠키 재바인딩
- [x] T15 콘솔 온보딩 폼 (URL 등록)
- [x] T16 마스킹 (규칙 CRUD + 마스킹본 생성 + export 연동)
- [x] T17 E2E: S2 DoD 시나리오
- [x] T18 CI 파이프라인 — 원격 개설(github.com/landfill/draftify-html, public)·GitHub Actions 워크플로우 커밋·첫 실행 green(58s, typecheck→build→test 113→e2e 2 passed)

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

### 2026-07-14 — 어노테이션 끝 번호 재사용 (킥오프 §11 12차)
- 브랜치: `fix/annotation-trailing-number-reuse` — 커밋 `f353cb5`, **Draft PR #6 열림**(main 병합 안 함).
- 배경(사용자 결정): 기존 단조 증가 카운터는 `1,2,3,4 → 1,3,4 → 신규 5 → 5 삭제 → 신규 6`으로 작성 중 마지막 항목을 삭제·재생성할 때 번호가 불필요하게 커졌다. 모든 번호를 당기는 재정렬은 기존 마커·참조 번호를 바꾸므로 제외.
- 완료: `addAnnotation`이 저장된 `annoNumberSeq`를 맹신하지 않고 현재 장면의 남은 최대 번호+1을 계산. 직접 삭제·[빈 어노테이션 정리] 모두 `annoNumberSeq`를 같은 규칙으로 갱신. 결과는 `1,3,4 → 신규 5`, 5 삭제 후 신규도 다시 5이며 중간 결번 2는 유지. 빈 어노테이션 정리 확인 문구도 끝 번호 재사용 가능으로 변경.
- 문서 동기화: 킥오프 §6.3·§11(12차), PRD R6, detailed-spec §3.4·POL-M02, technical-spec 데이터 모델·테스트, output-standard §1.2, shared 타입 주석. 과거 산출물과 새 산출물에서 재사용된 마지막 번호가 다른 항목을 가리킬 수 있는 트레이드오프와 전역 유일 `ann_*` 내부 ID의 역할을 명시.
- 검증: 신규 회귀 테스트 2건(직접 삭제, 빈 어노테이션 정리). `npm run typecheck`·`npm run build` 통과, `npm test` **184 passed**, `npm run test:e2e` **4본 통과**, PR #6 GitHub Actions `verify` green. 샌드박스 내 최초 전체 테스트는 로컬 listen EPERM으로 실패했으나 권한 허용 재실행에서 전부 통과(코드 실패 아님). 빌드의 기존 single-file-core IIFE `import.meta` 경고는 유지.
- **주의: SDK 변경 — 서버 재기동(빌드 반영) 후 적용. 기존 프로젝트는 다음 어노테이션 추가 시 현재 저장된 번호에서 자동 계산되므로 데이터 마이그레이션 불필요.**
- 다음 할 일: PR #6 CI·리뷰 확인. main 병합은 별도 명시적 동의 필요.
- 막힌 지점: 없음.

### 2026-07-14 — 동결 크기 절감: 폰트·비디오·오디오 콘텐츠 미임베드 (킥오프 §11 11차)
- 브랜치: `feat/freeze-block-fonts-media` → **PR #5로 main 병합 완료**(2026-07-14, rebase·CI green, 로컬·원격 브랜치 삭제). 리뷰 반영(gemini): neutralizeMedia가 라이트 DOM만 훑어 **open shadow DOM 미디어를 놓치는 갭** — single-file이 options.shadowRoots로 open shadow root를 직렬화함을 확인, open shadow root로 재귀하도록 수정(패널 data-mockspec-root shadow는 제외). shadow DOM 제거·복원 회귀 테스트 2건 + 실 Chromium(shadow 내부 video/audio 미임베드·요소 유지·라이브 복원) 재검증.
- 배경(사용자 결정): 스냅샷 비대화 케이스 분석 중 사용자가 "기획서는 디폴트 폰트로 충분, 비디오·오디오는 최대로 봐야 섬네일이고 섬네일도 과할 수 있어 와이어프레임 영역만 잡으면 된다"고 결정. 기존엔 `blockFonts`가 폴백(크래시) 경로에서만 발동 → 정상 성공한 CJK 페이지가 수 MB 폰트를 상시 임베드, 비디오·오디오는 미차단. "원본과 시각적 동일" 계약을 바꾸므로 AGENTS.md §4 절차대로 킥오프 §7·§11(11차)·T6 DoD 먼저 개정 후 구현.
- 완료(freeze.ts): ① FREEZE_OPTIONS 1차에 **`blockFonts:true`**(시스템 폰트) + `removeUnusedFonts`·`removeAlternativeFonts`(크래시 진원) off → 크기 + 크래시 표면 동시 감소 ② **`blockVideos:true`**(비디오는 포스터+링크 대체) ③ **`neutralizeMedia`** 신설 — single-file에 blockAudios 옵션이 없고 blockVideos도 오디오·비디오 poster는 못 막으므로, 동결 직전 audio·video·source의 `src`/`srcset`/`poster`를 임시 제거(요소=레이아웃 영역 유지) 후 finally 원복(margin 패턴과 동일). SAFE_FALLBACK도 스프레드로 동일 차단 유지.
- **발견(중요)**: `blockAudios`는 single-file-core에 없는 옵션(있는 건 blockVideos뿐) — 그래서 오디오/포스터는 옵션이 아니라 neutralizeMedia로 처리.
- 검증: `npm test` **180 passed**(+4: 1차 옵션 blockFonts/blockVideos 검증, neutralizeMedia 제거·요소 유지·복원), `npm run test:e2e` 4본 통과. **실 Chromium 검증(하니스)**: 웹폰트(40KB)+비디오/오디오(60KB)+포스터(30KB) fixture를 로컬 서버로 띄워 실제 single-file 동결 → 스냅샷 **82KB→2KB**, fontEmbedded/videoEmbedded 모두 false, `<video>`·`<audio>` 요소·본문 텍스트는 유지.
- **주의: SDK 변경 — 서버 재기동(빌드 반영) 필요. 기존 스냅샷은 재동결해야 크기 절감 적용.**
- 다음 할 일: 사용자 검토 → main 병합 동의 → 병합. 이후 후속 판단 잔여(스크린샷 fallback·옵션 S) 또는 S3.
- 막힌 지점: 없음.

### 2026-07-14 — 작성자 라벨 + 산출물 이력 (T29, FR-CON-03·FR-EXP-08)
- 브랜치: `feat/owner-label-export-history` → **PR #4로 main 병합 완료**(2026-07-14, rebase·CI green, 로컬·원격 브랜치 삭제). 리뷰 반영: gemini 봇 2건 — ① 손상된 exports.json이 GET /projects를 500으로 깨뜨림 → 파싱 실패 시 빈 이력 자가 치유 ② 동시 append 경쟁 → 프로젝트별 쓰기 직렬화(serialize promise 체인). codex 봇 P2 1건은 ②와 중복(원본 커밋 앵커)이라 답글로 정리. 각각 회귀 테스트 추가(vitest 178).
- 배경: 후속 판단 잔여 중 사용자 선택. S2 로드맵(아키텍처 §6·§3.5)에 원래 있던 항목 — 인증 없이 표시·오삭제 방지용 라벨(POL-M09) + 산출물 이력(FR-EXP-08). 사용자 결정 2건: **이력=메타 전용**(htmlRef 파일 보관 미채택 — 수십 MB 산출물을 매번 쌓지 않음, 재다운로드는 재-export로 충분), **라벨=ownerLabel 1개**(members[] 보류 — 편집자 1인 규칙과 겹쳐 실수요 미확인).
- 완료(shared): `SpecProject.ownerLabel?`(선택, 표시용) 승격 + `ExportRecord`·`ProjectListItem` 타입 신설. 왕복 무손실·필드 부재 하위 호환.
- 완료(server): ① `exportStore.ts` 신설 — `exports.json`(서버 소유 별도 파일, spec.json 밖 — PUT 전체 교체가 서버 기록 덮어쓰는 것 방지, token.json과 동일 이유)에 이력 메타 append + 목록 요약(`exportCount`·`lastExportAt`) ② `POST /export`가 성공 시 이력 기록(best-effort — 이력 실패가 export를 막지 않음), 마스킹본 사용 시 `masked:true` ③ `createProject`가 ownerLabel 수용, 세 등록 핸들러(zip·URL·snippet) 모두 `parseOwnerLabel`(공백 정리·60자 컷) ④ `GET /projects`가 항목마다 이력 요약 동봉.
- 완료(콘솔): 세 생성 폼에 "작성자(선택)" 입력, 카드 메타에 작성자·"내보내기 N회(날짜)", **삭제 confirm에 프로젝트명+작성자**(오삭제 방지), export 성공 후 목록 갱신(이력 요약 반영).
- 완료(뷰어): 산출물 헤더 메타에 "작성자 {라벨}"(있을 때만).
- 문서 동기화: technical-spec §2(ownerLabel 필드)·§2.2(예정 필드 갱신 — htmlRef 미채택·members 보류 근거)·§6 API표·§6.3(이력 신설)·§9.2 WBS T29, detailed-spec §2.2·§4.1, PRD §5·후속 판단 표. (기존 스펙이 예고만 한 필드의 구현 — 킥오프 §11 결정 변경 아님, 착수 확정 기록만)
- 검증: `npm run typecheck`·build exit 0, `npm test` **176 passed**(+7: shared 라벨 왕복 1 / export 이력 2 / store-api 라벨 생성·빈값 2 / 콘솔 폼 배선 1 / 뷰어 헤더 1), `npm run test:e2e` **4본 통과**. **실 서버(임시 데이터 디렉토리) 구동**: 라벨 생성(공백 "  김기획  "→"김기획")→export 2회→목록 `{ownerLabel:"김기획",exportCount:2,lastExportAt}`, 뷰어 헤더 "작성자 김기획 · 생성…", 콘솔 카드 "김기획 · … · 내보내기 2회", 삭제 confirm "'라벨 검증 프로젝트' (작성자: 김기획) …", 산출물 임베드 spec.ownerLabel="김기획" 확인.
- 다음 할 일: 사용자 검토 → main 병합 동의 → 병합. 이후 후속 판단 잔여(스크린샷 fallback·옵션 S) 또는 S3.
- 막힌 지점: 없음.

### 2026-07-14 — 뷰어 세로 스크롤 내부화 (3컬럼 고정, 답변 대기였던 제안 사용자 채택)
- 브랜치: `fix/viewer-internal-vertical-scroll` → **PR #3로 main 병합 완료**(2026-07-14, rebase·CI green, 로컬·원격 브랜치 삭제). 리뷰 피드백 1건(gemini 봇 — E2E 페이지 스크롤 검증의 서브픽셀 간헐 실패 가능성) 반영: 1px 허용 오차.
- 배경: 후속 판단 잔여 4건 중 사용자가 이 항목을 선택(이전 세션 제안의 채택 답변). 기존엔 `.ms-shell{min-height:100vh}`라 긴 스냅샷에서 **페이지 전체가 세로 스크롤** — 헤더·화면 목록·어노테이션 패널이 시야에서 사라짐.
- 완료(export.ts `VIEWER_CSS`만, 뷰어 JS 무변경): ① `.ms-shell`을 `height:100vh` 고정 — 세로 스크롤이 3컬럼 각자 내부로(컬럼들은 기존에 이미 `overflow:auto`) ② `.ms-layout`에 `grid-template-rows:minmax(0,1fr)` — auto 행이 콘텐츠 높이로 커져 셸을 넘치면 내부 스크롤이 안 생기는 문제 차단 ③ 흐름도 `.ms-flow-body`에 `max-height:40vh; overflow:auto` — 큰 그래프가 본문을 밀어내지 않게 ④ 모바일(≤900px, 1단 스택)은 `height:auto`로 페이지 스크롤 유지.
- 문서 동기화: detailed-spec §4.1 표에 "스크롤" 행 신설, user-guide §6에 3컬럼 내부 스크롤 서술 갱신 (기존 스펙은 스크롤 방식 무언급이라 킥오프 §11 절차 비대상).
- 검증: `npm run typecheck`·build exit 0, `npm test` 169 passed, `npm run test:e2e` **4본 통과**(transitions spec에 "페이지 세로 스크롤 없음 + `.ms-main` 내부 세로 스크롤" assertion 추가 — 장면 1이 captureHeight 800 > 뷰포트 720). **실 Chromium**: 산출물 file:// 오픈 → 중앙 305px 스크롤 후에도 헤더 top=0·사이드바·패널 가시·`windowScrollY:0` 스크린샷 확인.
- **주의: 뷰어 CSS 변경 — 기존 산출물엔 반영 안 됨, 재-export 필요 (재동결은 불필요).**
- 다음 할 일: 사용자 재-export로 새 레이아웃 확인(선택). 이후 후속 판단 잔여(스크린샷 fallback·작성자 라벨·옵션 S) 또는 S3 — 사용자 입력 대기.
- 막힌 지점: 없음.

### 2026-07-12 — 용어 개정: 사용자 표면 "장면"→"화면", "전이"→"화면 이동" (킥오프 §11 10차)
- 브랜치: `fix/ui-terms-screen-move` → **PR #2로 main 병합 완료**(2026-07-12, CI green·rebase, 브랜치 삭제).
- 배경(사용자 결정): "전이"는 기획 실무에서 처음 듣는 비통용어, "장면"도 "화면"이 통용 — 표면 용어를 통용어로.
- 완료: SDK 패널(섹션 제목·버튼 "+ 현재 화면 등록"·placeholder·안내문·드롭다운 "이동 없음")·뷰어(사이드바·메타·플레이스홀더·흐름도 노드 툴팁)·콘솔(메타·confirm·마스킹 문구)의 표시 문자열 전량 + README·user-guide 전면 + PRD §2 용어표(표면↔모델 매핑 명시). **코드 식별자(Scene·scn_·SCR-###)·스키마(transition)·스펙 본문 모델 용어·이력 문서는 유지** — 이유는 §11 10차.
- 검증: `npm test` 169 passed·`npm run test:e2e` 4본 통과(버튼명·콘솔 메타 문자열 의존 테스트 동기화).
- 다음 할 일: 후속 판단 잔여 또는 S3 — 사용자 입력 대기.
- 막힌 지점: 없음.

### 2026-07-12 — 전이·흐름도 스택 main 병합 (PR #1)
- `feat/scene-transitions`(T26~T28) + `fix/viewer-capture-width`(실사용 11~13차 + 사용 가이드)를 하나로 합쳐 **PR #1** 생성 → CI green(verify 1m11s) 확인 → **rebase 병합**(선형 이력 유지, 10커밋). 로컬·원격 브랜치 삭제.
- 포함: 전이 지정 UI·흐름도(자체 SVG)·전이 링크 / captureWidth·Height(반응형·100vh 재현) / 장면 제목 인라인 편집 / 경로 D 내보내기 chrome.downloads 직행 / 스냅샷 이미지 최적화(WebP) / docs/user-guide.md.
- 다음 할 일: 후속 판단 잔여(스크린샷 fallback·작성자 라벨·옵션 S) 또는 S3. **뷰어 세로 스크롤 내부화(3컬럼 각자 스크롤) 제안은 사용자 답변 대기.**
- 막힌 지점: 없음.

### 2026-07-12 — 사용 가이드 신설 (docs/user-guide.md — 세 연결 방식 상세)
- 브랜치: `fix/viewer-capture-width` (같은 브랜치에 docs 커밋).
- 배경(사용자 요청): "3가지 모드 각각 사용법·제약·적합한 경우·동작 원리를 담은 상세 가이드 필요 — 특히 '내 화면에서 편집'은 사용 방식이 까다로움."
- 완료: **docs/user-guide.md** — §0 한눈에 고르기(결정 플로우+비교표), §1~3 경로 A·B·D 각각 사용법/동작 원리/제약/적합(경로 D는 설치·연결·트러블슈팅 표까지 상세), §4 편집 공통(전이 포함), §5 마스킹, §6 산출물 읽는 법. 루트 README를 "빠른 시작"으로 재정의하고 세 경로 표+가이드 링크 추가, docs/README 문서 지도에 등록.
- 사용자 질문 답변 기록: **전이(프로세스 묶기)는 경로 D 전용이 아니라 "편집 패널 전용"(세 경로 공통)** — 어노테이션의 속성이라 라이브 편집에서만 지정하는 것은 의도된 설계("편집은 라이브, 산출물은 동결"). 콘솔=관리, 뷰어=읽기 전용. 가이드 §4에 명시.
- 검증: 문서만 변경.
- 다음 할 일: 사용자 검토 → 스택 main 병합 동의 대기.
- 막힌 지점: 없음.

### 2026-07-12 — 실사용 13차: 경로 D 내보내기 64MiB 실패 + 스냅샷 수십 MB 절감 (킥오프 §11 9차)
- 브랜치: `fix/viewer-capture-width` (12차에 이어 커밋).
- 배경(실사용): ① 경로 D 편집 패널 [내보내기]가 **"Message exceeded maximum allowed size of 64MiB"** — 산출물 HTML 전체가 background→content script 확장 메시지로 릴레이되는데 Chrome 메시징은 64MiB 하드 리밋 ② 사용자: "페이지 몇 개가 수십 MB — 사용하기 어렵다" — single-file이 고해상도 이미지(영화 포스터 등)를 원본 그대로 base64 임베드.
- 완료(①): **export를 chrome.downloads 직행으로** — `TransportRequest.download` 표시 → background가 본문 릴레이 대신 `chrome.downloads.download(url, POST, Bearer 헤더)` 호출(manifest `downloads` 권한 추가). 응답은 합성 마커(`x-mockspec-native-download`)만 릴레이, 패널은 "브라우저 다운로드로 저장을 시작했습니다" 표시. 경로 A·B(fetch transport)는 기존 blob 흐름 그대로. 경로 가드: 다운로드는 자기 프로젝트 export 경로만.
- 완료(②): **동결 후처리 스냅샷 이미지 최적화** (`freeze/optimizeImages.ts`) — 100KB 이상 래스터 data URI를 WebP q0.82 재인코딩 + 긴 변 2048px 다운스케일(업스케일 없음), 중복 URI 1회 인코딩 전부 치환, GIF·SVG·아이콘 제외, 이득 없으면 원본 유지, 이미지 단위 best-effort(동결 불파괴). WebP 인코딩은 ID-02(편집 Chrome/Edge 한정)로 무방.
- 검증: `npm test` **169 passed**(+6: export download 표시·native 마커 분기 2 / optimizeImages 4 — 치환·중복 1회 인코딩·스킵 규칙·실패 원본 유지), e2e 4본 통과. **실 Chromium(확장 로드)**: ① 패널 내보내기 → 안내 문구 + chrome.downloads `state: complete` ② 노이즈 PNG 21.2MB(최악 케이스) 페이지 동결 → 스냅샷 10.4MB·webp 2회 치환·원본 png 잔존 0·naturalWidth 2048·file:// 렌더 정상. 실제 사진류는 절감 폭 더 큼.
- **주의: 확장 재로드(chrome://extensions 새로고침) + 서버 재기동 필요. 기존 스냅샷은 재동결해야 이미지 최적화 적용.**
- 다음 할 일: 사용자 재검증(재동결→내보내기) → main 병합 동의 대기.
- 막힌 지점: 없음.

### 2026-07-12 — 실사용 12차: 100vh류 캡처 아래쪽 잘림(captureHeight) + 장면 제목 자동 부여 철회
- 브랜치: `fix/viewer-capture-width` (11차에 이어 커밋).
- 배경(실사용, c.html): ① tmdb-quiz(React·Tailwind `h-screen`) 산출물에서 어노테이션 5·7(메인 메뉴·박스오피스)의 **아래쪽 콘텐츠가 안 보임** — 100vh류 페이지는 html/body가 뷰포트 높이라 scrollHeight가 항상 iframe 높이와 같고, 뷰어 최소값 480px에 잠겨 `overflow:hidden` 안쪽 콘텐츠(실측 최하단 590px)가 잘림. 마커는 요소 좌표(504~590)라 흰 영역에 뜸 ② **장면 제목에 목업 페이지의 `document.title`("tmdb-quiz")이 자동으로 붙음** — SPA는 `<title>`이 불변이라 모든 장면이 같은 무의미한 제목. 사용자 판정 "불필요".
- 완료(①): **`Scene.captureHeight`**(동결 시점 `documentElement.clientHeight`) 기록 — `setSceneSnapshot(…, capture: {width, height})`. 뷰어는 captureHeight를 기준 높이로 먼저 리플로우(캡처 레이아웃 재현). **구 스냅샷 구제**: captureHeight 없고 scrollHeight가 뷰포트에 잠긴 경우 요소 실제 최하단까지 확장 — vh 성분은 확장을 따라 다시 커지므로 **secant 외삽으로 고정점 수렴**(상한 4000px, k≥0.98이면 발산 판정). **정착 레이스**: 로드 직후(~150ms)는 웹폰트 적용·초기 레이아웃 정착 전이라 수 px 부족하게 수렴(실측 50ms=696 vs 150ms+=700) — 더블 rAF·`fonts.ready`·300ms 백스톱 3중 재계산(멱등)으로 해소.
- 완료(②, 킥오프 §11 8차): 장면 제목 **기본값 document.title 철회** — 빈 값 생성 + 패널 장면 목록에 **제목 인라인 입력**(`updateSceneTitle`, placeholder "장면 제목"). detailed-spec §3.2·technical-spec §2·s1-kickoff 동기화.
- 검증: `npm run typecheck`·build exit 0, `npm test` 163 passed(+2: setSceneSnapshot 캡처 크기 / 장면 제목 빈 값 생성·인라인 명명), `npm run test:e2e` 4본 통과(transitions에 iframe=captureHeight(800) 검증 추가). **실 c.html 데이터 재조립 검증(구제 경로)**: SCR-004 iframe 480→700 수렴, 박스오피스 "보임", 하단 메뉴 전체 노출, 마커 5·7 콘텐츠 정렬 — 스크린샷 확인.
- **주의: 서버 재기동 + 재-export 필요. 기존 장면은 재동결해야 captureHeight가 채워짐(구제 로직으로 재동결 없이도 대부분 노출).**
- 다음 할 일: 사용자 재검증 → 전이·흐름도와 함께 main 병합 동의 대기. 별건: 뷰어 세로 스크롤을 중앙 내부로(3컬럼 고정) 제안은 사용자 답변 대기.
- 막힌 지점: 없음.

### 2026-07-12 — 실사용 11차: 반응형 캡처가 산출물에서 모바일 레이아웃으로 보임 → captureWidth 기록
- 브랜치: `fix/viewer-capture-width` (`feat/scene-transitions` 위에 스택, main 미병합).
- 배경(실사용): 내보낸 문서에서 캡처했던 화면이 **모바일 레이아웃으로** 보임. 원인: 9차 수정의 `.ms-stage-wrap{width:max-content}` + `.ms-frame{width:100%}` 조합에서 **max-content 부모의 100%는 순환이라 iframe이 기본 300px로 붕괴** → 반응형 스냅샷이 300px에서 첫 레이아웃(모바일로 리플로우) → `renderMarkers`의 scrollWidth 측정도 300으로 오염되어 고정. 고정폭 페이지(HANATOUR 1920)는 scrollWidth가 커서 증상이 안 보였음. 실측 재현: 중앙 940px인데 iframe 300px.
- 완료: ① **shared** — `Scene.captureWidth?`(동결 시점 `documentElement.clientWidth`) ② **SDK** — `setSceneSnapshot`이 captureWidth 기록(동결·재동결 모두. 동결이 도킹 마진을 제거하므로 전체 뷰포트 폭이 기준) ③ **뷰어** — 기준 폭 = captureWidth, 없으면(구 스냅샷) **중앙 가용 폭 폴백**. 기준 폭으로 먼저 리플로우한 뒤 scrollWidth를 측정해 넓은 고정폭 캡처의 가로 스크롤(9차 동작)은 유지.
- 검증: `npm test` **161 passed**(+1: setSceneSnapshot captureWidth), `npm run test:e2e` 4본 통과(transitions spec에 장면 1 iframe=1280·구 스냅샷 폴백 >500 검증 추가). **실 Chromium**: 반응형 fixture(700px 미만 모바일 스택)로 — captureWidth=1280 산출물은 3컬럼 데스크톱 재현·모바일 배지 미노출, 폴백 산출물은 908px(300px 붕괴 해소).
- **주의: 뷰어/export/SDK 변경 — 서버 재기동 + 재-export 필요. 기존 장면은 재동결해야 captureWidth가 채워짐(재동결 없이도 폴백으로 300px 붕괴는 해소).**
- 다음 할 일: 사용자 재-export로 캡처 레이아웃 재현 확인 → 전이·흐름도와 함께 main 병합 동의 대기.
- 막힌 지점: 없음.

### 2026-07-12 — 다중 장면 전이 + 흐름도 구현 (T26~T28, FR-EDT-10·FR-EXP-06)
- 브랜치: `feat/scene-transitions` (main 미병합, 동의 대기). 착수 배경: S2.5 종료 후 "후속 판단" 중 사용자가 전이+흐름도를 1순위로 선택.
- **결정(사용자, 킥오프 s1 §11 7차 개정)**: 흐름도 렌더러 **Mermaid → 자체 경량 SVG** — 산출물이 단독 HTML·네트워크 0건이라 Mermaid는 ~3MB 번들 내장이 필요(뷰어 런타임 19KB의 150배), 장면 그래프 규모(수십 노드 이하)엔 계층 배치+화살표+간선 라벨의 자체 SVG로 충분. PRD·detailed-spec·output-standard·technical-spec 동기화 완료.
- 완료(T26 shared): `Annotation.transition { toSceneId, condition? }`을 §2.2 예정 필드에서 본 모델로 승격. 왕복 무손실·필드 부재 하위 호환 테스트.
- 완료(T27 SDK): 어노테이션 폼에 전이 드롭다운(**다른 장면만** 나열)+조건 텍스트(전이 선택 시에만 노출, 빈 조건은 필드 미저장). `deleteScene`이 삭제 장면을 향한 transition을 함께 제거(dangling 방지). focusShield의 클릭 포커스 차단 대상에 SELECT 추가(Nexacro류 대응).
- 완료(T28 뷰어·산출물): ① 어노테이션 카드에 **전이 링크** "조건 → SCR-### 제목 보기" — 클릭 시 장면 전환(실행 대신 이동), 대상 장면 없으면 미표시 ② 헤더 아래 **프로세스 흐름도 섹션**(output-standard §2 섹션 2) — 자체 SVG: back-간선 제외 longest-path 계층 배치(순환 무한루프 없음), 병렬 전이 라벨 " / " 병합, 정방향 베지어+역방향 하단 우회, 노드 클릭 시 장면 전환, 접기 토글, 전이 0건이면 섹션 생략 ③ `.ms-shell`을 flex 컬럼으로(흐름도 유무 모두 본문이 잔여 높이 채움), 흐름도는 섹션 내부만 가로 스크롤.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **160 passed**(+11: shared 왕복 1 / state 전이 지정·장면삭제 정리 2 / App 드롭다운 왕복·단일 장면 미노출 2 / focusShield SELECT / viewer 간선 정리·계층·순환·통합 렌더·생략·접기 6). `npm run test:e2e` **4본 통과**(신규 `e2e/transitions.spec.ts` — snippet API로 전이 spec 구성→export→file://에서 흐름도 노드/라벨·전이 링크 전환·네트워크 0건·프로젝트 정리). **실 Chromium 시각 확인**: 분기+순환(로그인→홈/오류, 오류→로그인) 그래프에서 계층·라벨·순환 우회 곡선·링크 클릭 전환 스크린샷 검증.
- **주의: 뷰어/export 코드 변경 — 기존 산출물엔 반영 안 됨, 재-export 필요. SDK 변경으로 서버 재기동(빌드 반영)도 필요.**
- 다음 할 일: 사용자 실사용 검증(전이 지정→export→흐름도 확인) → main 병합 동의 → 병합. 이후 후속 판단 잔여(스크린샷 fallback·작성자 라벨·옵션 S) 또는 S3.
- 막힌 지점: 없음.

### 2026-07-12 — S2.5 스택 전체 main 병합 (T22~T25 + 실사용 fix 10건)
- `feat/s25-extension-scaffold-t22` → `t23` → `t24` → `fix/console-snippet-id-visibility` 스택(13커밋) → `main` 병합 완료(2026-07-12, fast-forward)·push. 병합 후 네 브랜치(로컬·원격) 삭제.
- 포함: T22(확장 스캐폴드)·T23(저장 릴레이)·T24(E2E DoD)·T25(실사용 판정) + 실사용 fix 10건(연결 코드·동결 폴백·blockFonts·포커스 5~8차·뷰어 스크롤·네비 접기). **S2.5 종료.**
- 다음 할 일: 후속 판단(다중 장면 전이·흐름도·스크린샷 fallback·작성자 라벨) 또는 S3(자동화). 사용자 우선순위 입력 대기.

### 2026-07-12 — 실사용 10차: 뷰어 왼쪽 장면 네비 접기 토글
- 브랜치: `fix/console-snippet-id-visibility` → main 병합(위 참조).
- 완료: 뷰어에 **왼쪽 장면 네비 접기/펼치기** — `ViewerState.sidebarCollapsed`, 헤더에 «(접기), 접힘 시 40px 레일 + »(펼치기). `.ms-layout--collapsed`로 그리드 컬럼을 `40px 1fr 300px`로(클래스라 모바일 미디어쿼리 정상 우선). 접으면 중앙이 넓어져 가로 스크롤 감소.
- 검증: `npm test` 149 passed·`npm run test:e2e` 3본 통과. **실 Chromium**: 1280px 뷰포트에서 접기 시 중앙 780→940px(+160), `.ms-layout--collapsed` 적용·레일 펼치기 버튼·재펼침 복원(장면 버튼 2개)·다중 장면 유지 확인.
- **주의: 뷰어/CSS 변경 — 재-export + 서버 재기동 필요.**
- 다음 할 일: 사용자 재검증 → S2.5 실사용 판정 → 스택 병합.
- 막힌 지점: 없음.

### 2026-07-12 — 실사용 9차: 뷰어(산출물) 넓은 데스크톱 캡처 잘림
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋). (8차 포커스 수정으로 저장 성공 확인됨.)
- 배경: export 산출물 뷰어(3단: 장면/스냅샷/어노테이션)에서 HANATOUR 같은 **넓은 데스크톱 캡처(~1920px)가 좁은 중앙(1fr)에 눌려 오른쪽이 잘림**(마커 2도 화면 밖). 원인: iframe `width:100%`+ `.ms-stage-wrap{overflow:hidden}`이라 가로 스크롤 불가.
- 완료: ① `viewer/main.ts::renderMarkers`가 **iframe·마커 레이어를 콘텐츠 자연 너비(docWidth)로** 지정 ② `export.ts` CSS — `.ms-stage-wrap{width:max-content}`(넓은 iframe을 감싸도록)로 `.ms-main`이 **양방향 스크롤** ③ 사이드/패널 폭 축소(220→200, 320→300)로 중앙 확대. 마커는 콘텐츠와 같은 좌표계라 스크롤해도 정확히 정렬.
- 검증: `npm test` 149 passed·`npm run test:e2e` 3본 통과(좁은 fixture 마커 ≤2px 회귀 없음). **실 Chromium(넓은 1920px 산출물)**: `.ms-main` scrollWidth 1954>client 780(가로 스크롤 생김), iframe 1920px, 우측 끝 요소 마커 left=1875(자연좌표 정렬) 확인.
- **주의: 이 수정은 뷰어/export 코드라 기존에 내보낸 HTML엔 반영 안 됨 — 다시 export해야 적용됨.**
- 다음 할 일: 사용자가 재-export해 넓은 화면이 가로 스크롤로 보이는지 확인 → S2.5 실사용 판정.
- 막힌 지점: 없음. (더 넓은 화면 대응으로 사이드 패널 접기 토글은 후속 판단 — 지금은 스크롤로 해결)

### 2026-07-12 — 실사용 8차(근본 해결): Nexacro는 mousedown/pointerdown preventDefault
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경: 7차(window 캡처 focus shield)도 실사이트에서 안 통함. **진짜 메커니즘 재현**: Nexacro는 document 캡처 단계에서 **`mousedown`·`pointerdown`을 `preventDefault()`** — mousedown/pointerdown의 기본 동작이 "포커스"라 우리 입력칸 클릭이 포커스를 못 얻는다. 유일하게 프로그램적으로 포커스되는 마지막 항목만 입력됨(실사용 증상과 정확히 일치 — repro로 `titles:["","","첫제목둘째설명"]` 재현).
- 완료: `focusShield.ts` 확장 — window 캡처에서 ① focus/blur/focusin/focusout은 패널 안이면 전부 차단(포커스 되돌리기 방어) ② **mousedown·pointerdown은 실제 타겟이 INPUT/TEXTAREA일 때만** 차단(클릭 포커스 복원). 마커의 pointerdown(드래그)은 타겟이 button이라 차단 안 함 → **드래그 보존**. 선택 추종은 onMouseDown→**onClick**으로 이동(mousedown이 shield로 안 타므로).
- **재현·확증(실 Chromium)**: mousedown+pointerdown preventDefault 트랩에서 — shield 전 `titles:["","","..."]`(증상 재현), shield 후 `titles:["첫제목",...]` `descs:[_,"둘째설명",_]` 정상. focus 트랩도 통과. **마커 드래그 트랩 하 보존 확인**(29px 이동).
- 검증: `npm test` **149 passed**(focusShield 입력칸/비입력 케이스 +1, App 선택추종 onClick), `npm run test:e2e` 3본 통과.
- 다음 할 일: 사용자 HANATOUR 재검증(이번이 근본 원인) → 되면 편집·저장·export → T25 판정 → S2.5 종료.
- 막힌 지점: 없음.

### 2026-07-11 — 실사용 7차: focusShield를 window 캡처로 (Nexacro는 캡처 단계)
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경: 6차의 호스트 버블 차단이 실사이트에서 안 통함(현상 동일, `id.split` 에러 여전). Nexacro가 **document 캡처 단계**로 포커스를 관리하기 때문 — 버블 차단은 캡처 핸들러를 못 막는다(캡처가 먼저 발동). 캡처형 트랩 재현으로 확인.
- 완료: `focusShield.ts`를 **window 캡처 리스너**로 재작성 — 우리 호스트로 향하는(composedPath에 호스트 포함) focus/blur/focusin/focusout을 stopImmediatePropagation. 캡처 전파 순서가 window→document이라 페이지(document) 캡처 핸들러보다 **먼저** 끊는다. 부수: 우리 패널의 focus 리스너도 안 타므로 **선택 추종을 onFocus→onMouseDown으로 이동**(App.tsx). 입력 자체·키입력은 무영향.
- **재현·확증**: 캡처형 트랩 페이지에서 버블-shield는 실패(타이핑 전부 페이지로 샘 — 실사용 증상 재현), **window 캡처 shield는 앞 칸·설명창 정상**. git 대조로 확정.
- 검증: `npm test` **148 passed**(focusShield 테스트를 캡처 대조로 갱신, App 선택추종을 mousedown으로), `npm run test:e2e` 3본 통과.
- 다음 할 일: 사용자 HANATOUR 재검증 → 되면 편집·저장·export → T25 판정.
- 막힌 지점: 없음. (혹시 window 캡처로도 안 되면 Nexacro가 activeElement 폴링/다른 기법일 수 있음 — 그땐 iframe 격리 검토)

### 2026-07-11 — 실사용 6차 피드백(진짜 원인 후보): Nexacro 포커스 트랩 → focusShield(호스트 버블)
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경(실사용 로그가 결정타): HANATOUR = **Nexacro**(TOBESOFT, `Platform_HTML5.js`·`nexacro.__setViewportScale`) 앱. 콘솔에 `Platform.js: id.split is not a function` 폭주 — Nexacro의 **document 레벨 전역 focusin 핸들러**가 우리 패널 입력(자기 컴포넌트 아님)에 포커스가 가면 자기 요소로 되돌린다 → 앞 칸·설명창 포커스 불가, 타이핑이 페이지로 샘. (5차의 selectedAnn 추종만으론 부족 — 페이지가 focusin으로 포커스를 뺏는 게 근본 원인)
- 완료: **`focusShield.ts`** — SDK 호스트(Shadow 경계)에서 `focusin`/`focusout`을 `stopImmediatePropagation`. Shadow 경계에서 이 이벤트들은 호스트로 리타깃되어 버블하므로, 호스트에서 끊으면 document의 페이지(프레임워크) 핸들러까지 전파 안 됨. main.tsx가 부트 시 적용. 내부 포커스 처리는 shadow 안이라 무영향.
- **재현·확증(드디어)**: 포커스 트랩(app 밖 focusin → 페이지 필드로 refocus) 페이지로, **shield 없으면** 타이핑이 전부 페이지 필드로 새고 우리 입력 전부 빈칸(사용자 증상 정확히 일치), **shield 있으면** 앞 칸·설명창 정상. git stash로 shield 유무 대조 검증.
- 검증: `npm test` **148 passed**(+2: 호스트 내부 focusin이 document 미도달 / 대조군은 도달). `npm run test:e2e` 3본 통과. 5차 수정(자동 포커스 생성 한정+선택 추종)도 유지 — 둘 다 필요.
- 다음 할 일: 사용자가 HANATOUR에서 앞 칸·설명창 입력 재검증 → 되면 편집·저장·export → T25 실사용 판정 → S2.5 종료.
- 막힌 지점: 없음. (참고: Nexacro의 `id.split` 에러는 자체 에러라 무해 추정 — 우리 shield로 focusin 유입이 줄어 빈도도 감소할 수 있음)

### 2026-07-11 — 실사용 5차 피드백: 어노테이션 포커스가 마지막 칸으로 튐
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경(실사용): 어노테이션 여러 개일 때 **앞 번호 칸을 클릭·타이핑해도 글자가 마지막 칸에 들어감**(한글·영문 무관). 원인: title 자동 포커스 effect가 `selectedAnn`(마지막 생성 항목)을 향하는데, 앞 칸을 편집해도 선택이 따라가지 않아 재렌더 시 포커스가 마지막으로 돌아감. (확장·단순 페이지로는 미재현 — 실사이트 라이브 JS의 잦은 재렌더가 트리거로 추정)
- 완료: ① **자동 포커스를 "방금 생성한 항목"으로 제한** — `newAnnRef`를 생성 시에만 세팅, effect는 `newAnnRef.current === selectedAnn`일 때만 `focus()`(그 후 클리어). 생성 외 선택 변경(마커 클릭·앞 칸 편집)엔 포커스를 옮기지 않음 ② **선택이 편집 칸을 따라감** — title·desc 입력에 `onFocus → setSelectedAnn(a.id)`. 이제 어떤 재렌더가 나도 포커스가 마지막으로 튀지 않고 편집 중인 칸에 유지.
- 검증: `npm test` **146 passed**(+1: 앞 칸 focus 시 선택이 그 칸을 따라가고 입력해도 유지 — happy-dom은 shadowRoot 없어 focus() 자체는 미검증, 선택 추종 로직으로 대체). `npm run test:e2e` 3본 통과. 실 Chromium에서 재렌더(마우스무브)+디바운스 저장 섞어 타이핑해도 앞 칸 유지 확인. **원 버그는 재현 불가라 "치유" 증명은 사용자 재검증 필요** — 수정은 증상의 직접 원인(자동 포커스 강탈)을 제거.
- 다음 할 일: 사용자가 HANATOUR에서 앞 번호 칸 편집 재검증 → 되면 편집·저장·export → T25 실사용 판정.
- 막힌 지점: 없음.

### 2026-07-11 — 실사용 4차 피드백: 폴백 스냅샷 50MB 초과 → blockFonts로 재설계
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경(실사용): 3차 폴백으로 `^local(` 크래시는 넘겼으나, 폴백이 `removeUnusedFonts:false`라 **모든 웹폰트(HANATOUR 한글 폰트 — 웨이트당 수 MB)를 base64 임베드** → 스냅샷 **50MB 초과**로 asset 업로드 거부(413).
- 완료: 폴백에 **`blockFonts: true` 추가** — single-file이 폰트 리소스를 아예 안 가져온다(core line 205 게이트). 스냅샷은 시스템 폰트로 렌더(기획서 용도 무방), 크기 정상화·네트워크 0건 유지. 크래시 진원 액션(`removeAlternativeFonts` 등)은 계속 off. blockScripts+<script> 0개 검증은 유지.
- 검증: `npm test` 145 passed(폴백 유닛 assertion을 blockFonts로 갱신), `npm run test:e2e` 3본 통과. `blockFonts`는 single-file 정식 옵션(source 확인).
- 다음 할 일: 사용자가 HANATOUR 화면에서 재시도 → 폴백(폰트 없이 동결)으로 통과·저장되는지 확인. 통과 시 편집·export → T25 판정.
- 막힌 지점: 폴백으로도 크기/렌더가 문제면 재확인 필요(로그인 게이트로 직접 재현 불가). 정상 경로에서도 CJK 폰트 사용 페이지가 50MB에 근접할 수 있음 — 실수요 보고 asset 상한/폰트 정책 후속 판단.

### 2026-07-11 — 실사용 3차 피드백: 동결 실패(single-file 정규식) 폴백
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경(실사용): 실제 HANATOUR 로그인 화면(확장 연결 성공)에서 장면 등록 시 **동결 실패 — "Invalid regular expression: /^local(/: Unterminated group"**. single-file-core가 실사이트의 복잡한 CSS(@font-face `local()` 소스가 얽힌 조건 파싱)를 처리하다 내부에서 정규식 오류로 throw. 원인 경로: `removeAlternativeFonts` 액션 내부의 media/supports 조건 파싱(css-media-query-parser `new RegExp(filter)`). 로그인 게이트라 정확한 CSS 재현은 불가.
- 완료: **`freeze.ts` 2단 폴백** — 1차(전체 최적화) 실패 시 **CSS 최소화를 끈 안전 옵션**(`removeUnusedFonts`·`removeAlternativeFonts`·`removeUnusedStyles`·`removeAlternativeMedias`·`groupDuplicateImages`·`compressHTML` = false)으로 **1회 자동 재시도**. 핵심 무해화(`blockScripts` + `<script>` 0개 검증)는 폴백에서도 유지. 우리 규칙 위반(FreezeError)은 재시도 무의미하므로 전파. 스냅샷이 다소 커질 뿐 시각 완전성·네트워크 0건 유지.
- 검증: `npm test` **145 passed**(+3: 1차 성공 무폴백 / 내부 오류 시 CSS-off 옵션으로 재시도·blockScripts 유지 / FreezeError는 재시도 안 함 — getPageData 목킹). `npm run test:e2e` 3본 통과(정상 경로=1차 성공, 폴백 미발동 회귀 없음). **재현 시도**: 합성 `local()` 폰트로는 미재현(실사이트 특정 CSS) — 폴백은 원인 액션(removeAlternativeFonts)을 직접 끄므로 겨냥 정확.
- 다음 할 일: 사용자가 실제 HANATOUR 화면에서 동결 재시도 → 폴백으로 통과하는지 확인(제가 로그인 게이트라 직접 검증 불가). 통과 시 편집·저장·export까지 → T25 실사용 판정 → S2.5 종료.
- 막힌 지점: 폴백이 그 사이트의 정확한 CSS를 커버하는지는 **사용자 재검증 필요**(재현 불가). 폴백으로도 실패하면 실패 CSS 조각을 받아 원인 정밀 대응.

### 2026-07-11 — 실사용 2차 피드백: 연결 코드 1개로 통합 (팝업 소실 문제 해결)
- 브랜치: `fix/console-snippet-id-visibility` (같은 fix 브랜치에 이어 커밋).
- 배경(실사용): 사용자 — "프로젝트 ID·토큰 **둘을 각각 복사·붙여넣기**하는데, 확장 팝업이 포커스를 잃으면 닫혀서 유지가 안 돼 **사용 불가**." (Chrome 확장 팝업은 blur 시 닫힘 — 값 복사하러 콘솔 가면 팝업 소멸 → 무한 반복)
- 완료: **연결 코드 1개 = 한 번 복사 → 한 번 붙여넣기.** ① `shared/connection.ts` — `encodeConnection`/`decodeConnection`(`mockspec:`+base64url(JSON{p,t,s}), prj_·tok_ 검증) ② 콘솔: 생성 시 토큰을 sessionStorage 보관 + **연결 코드** 표시, 카드 [연결 코드 복사], 재발급 시 새 연결 코드 자동 클립보드(인라인 encodeConnection은 shared와 바이트 동일 — ASCII) ③ 확장 팝업 재설계: **[연결 코드 붙여넣기]** 단일 textarea + [연결](decode→writeBinding)이 주 경로, "직접 입력"은 details fallback.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **142 passed**(+4: 코덱 왕복·공백 허용·오류 null·콘솔/shared 형식 일치). `npm run test:e2e` 3본 통과. **실 Chrome**: 콘솔에서 snippet 생성→표시된 연결 코드를 shared 디코더가 `{projectId,token,serverUrl}`로 정확히 복원 확인, 팝업 DOM 배선·스크립트 오류 0(실 Chromium).
- 다음 할 일: 사용자가 [연결 코드 복사] → 팝업 붙여넣기 → 편집·저장 재검증 → T25 실사용 판정 → S2.5 종료.
- 막힌 지점: 없음. (진짜 원클릭 연결은 externally_connectable+고정 확장 key가 필요 — 현재 한 번 붙여넣기로 충분, 후속 판단)

### 2026-07-11 — 실사용 1차 피드백: 확장 프로젝트 ID 가시성 + 콘솔 JS 파싱 가드
- 브랜치: `fix/console-snippet-id-visibility` (T22~T24 스택 위, main 미병합).
- 배경(실사용): 사용자가 확장을 **실제 Chrome에 unpacked 로드**해 써봄. 팝업 "프로젝트 ID"에 프로젝트 **이름**(`dasfs`)을 넣어 "불러오기 실패(프로젝트 dasfs를 찾을 수 없습니다)" 발생. 원인: **콘솔이 snippet 프로젝트의 ID(`prj_…`)를 목록에서 안 보여줘** 이름과 혼동. (사용자 선택: 카드에 ID 표시 + 원클릭 연결)
- 완료: ① 콘솔 snippet 카드에 **프로젝트 ID를 항상 표시**(선택 가능한 code) ② **[연결 정보 복사]** 버튼(프로젝트 ID·서버 주소·토큰(세션 보유 시) 라벨 블록) ③ 팝업 입력 가드 — ID가 `prj_`, 토큰이 `tok_`로 시작하지 않으면 명확한 에러(이름/ID 혼동 안내), 라벨도 "이름이 아니라 prj_로 시작하는 값".
- **실버그(사용자 실사용이 잡음)**: 새 `copyConnectionInfo`에서 `"\n"`을 썼는데 `CONSOLE_JS`가 TS 템플릿 리터럴이라 빌드 시 **실제 개행**이 되어 인라인 콘솔 JS 전체가 문법 오류 → **프로젝트 목록이 아예 렌더 안 됨**. `\\n`으로 수정. 유닛 테스트는 문자열 존재만 봐서 놓쳤음(런타임 파싱 미검증).
- 완료(회귀 방지): `console.test.ts`에 **인라인 JS 파싱 가드** — `new Function(스크립트)`로 문법만 검증(실행 안 함). raw 개행류를 SyntaxError로 잡음(역검증 완료).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **138 passed**(+2: 카드 ID·복사 존재 / 인라인 JS 파싱). `npm run test:e2e` 3본 통과. **실 Chrome**: 목록 정상 렌더, `dasfs` 카드에 `프로젝트 ID prj_mix3iprwke` 표시·[연결 정보 복사] 확인.
- 다음 할 일: 사용자가 실제 ID(`prj_…`)로 재연결해 편집 흐름 재검증 → T25 실사용 판정 기록 → S2.5 종료.
- 막힌 지점: 없음.

### 2026-07-11 — T24 경로 D E2E (로그인 뒤 화면 DoD) 완료
- 브랜치: `feat/s25-ext-e2e-t24` (T22→T23 위에 스택, main 미병합 — 순서대로 병합 대기).
- 완료: **`e2e/pathD-dod.spec.ts`** (pathD 킥오프 §7 DoD) — ① 로그인 fixture를 테스트 내장 http 서버로 서빙(빌드 배선 없음): `/`(폼)·`POST /login`(host-only 쿠키)·`/protected`(쿠키 없으면 302) ② 확장 unpacked 로드(`launchPersistentContext` + `--load-extension`, `channel:"chromium"` 신 headless) + 팝업 storage로 오리진↔프로젝트(토큰) 바인딩 ③ **직접 로그인**(폼 제출→쿠키)→보호 화면→확장 SDK 주입→장면 등록·어노테이션 2개·**동결·저장(토큰 릴레이)** ④ 콘솔에서 마스킹 규칙(`홍길동`→`고객`, 토큰은 sessionStorage 선주입으로 prompt 회피) 적용→export ⑤ 새 컨텍스트 file:// 오픈→**마스킹 원문 0회**·치환문 존재·마커 2개 위치 오차 ≤2px·설명 일치·**네트워크 0건** ⑥ 보안 회귀: 토큰 없는 PUT 401.
- 실버그(테스트가 잡음): pathD spec이 알파벳 순 **먼저** 실행되어 남긴 snippet 프로젝트가 콘솔 목록에 잔류 → S1/S2(단일 프로젝트 목록 가정, strict-mode 버튼 매칭)가 깨짐. **pathD가 끝에서 자기 프로젝트를 DELETE**해 공유 서버 잔재 제거(S1/S2 DoD 미변경).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` 136 passed, `npx playwright test` **3본 통과**(S1·S2·경로 D). 확장 dist는 `npm run build`가 자동 조립.
- 다음 할 일: **T25** — docs/ 최종 동기화(구현 결과 반영)·실사용 판정 기록으로 S2.5 종료.
- 막힌 지점: 없음. (CI에서 `channel:"chromium"` 확장 로드는 push 후 확인)

### 2026-07-11 — T23 background 저장 릴레이 완료 (경로 D 저장 경로 관통)
- 브랜치: `feat/s25-ext-save-relay-t23` (T22 위에 스택, main 미병합 — T22→T23 순 병합 대기).
- 완료(SDK): **transport 추상화** `sdk/src/transport.ts` — ① `fetchTransport`(기본, 경로 A·B same-origin fetch 그대로) ② `createBridgeTransport`(경로 D — window.postMessage 요청/응답 상관, 30s 타임아웃으로 실패 시 오프라인 큐가 받게) ③ `api.ts`를 transport 경유로 리팩터링(호출부 4개: GET/PUT/assets/export — 본문·응답을 문자열로 정규화, chrome 메시지가 JSON만 지원·스냅샷/export가 본질 텍스트라 무손실) ④ `main.tsx`가 주입 태그 `data-transport="extension"`(shared 상수 신설)을 보고 브리지로 교체.
- 완료(확장): ① `content.ts` — 브리지 릴레이(페이지 postMessage ↔ chrome.runtime.sendMessage), 주입 태그에 transport 속성 ② `background.ts` — **fetch 릴레이**: sender.origin의 바인딩만 사용(위조 불가), **자기 프로젝트 API 경로만 허용**(경로 가드), Bearer 토큰은 background에서만 부착(페이지에 토큰 미노출), 스냅샷은 FormData 재조립, `X-Mockspec-Page-Origin` 부착. host_permissions(localhost) 기반이라 CORS 불필요(서버 CORS 미구현 유지).
- 완료(서버): PUT에서 snippet 프로젝트의 **mockupSource를 서버 소유로 보호**(클라이언트 조작 무시) + `X-Mockspec-Page-Origin`을 `lastSeenOrigin`으로 스탬프(헤더 없으면 기존 유지).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **136 passed**(+4: 브리지 상관·동시 2건 교차 없음 / 오류 reject / 타임아웃→큐 인계 / 서버 lastSeenOrigin 스탬프+mockupSource 조작 무시). `npm run test:e2e` 2 passed 회귀 없음. **실 Chromium 스크래치(전 과정)**: 실서버 기동→snippet 등록→확장 바인딩→fixture 페이지에서 **프로젝트 로드(GET 브리지)→장면 등록→동결→스냅샷 업로드→PUT 저장** 성공, 서버 spec에 장면 1·snapshotAsset·`lastSeenOrigin=페이지 오리진` 확인.
- 참고(테스트 인프라): vitest happy-dom은 window가 프록시라 postMessage의 `ev.source === window` 가드와 불일치 — 테스트는 `source` 없는 MessageEvent 직접 dispatch로 우회(가드는 유지, 실브라우저는 스크래치가 커버). App.test의 fetch 스텁은 "init 없음=GET" 가정이었어서 메서드 기준으로 수정.
- 다음 할 일: **T24 E2E 로그인 시나리오** — 로그인 fixture(폼+보호 화면) 작성, Playwright `launchPersistentContext`+`--load-extension`으로 pathD 킥오프 §7 DoD 자동화(마스킹·export·보안 회귀 포함).
- 막힌 지점: 없음.

### 2026-07-11 — T22 확장 스캐폴드 + content script SDK 주입 완료
- 브랜치: `feat/s25-extension-scaffold-t22` (main 미병합, 동의 대기).
- 완료: **`packages/extension`** 신설 (npm workspace 편입, 루트 build·typecheck 연결) —
  ① `manifest.json` MV3: content script `<all_urls>`·`web_accessible_resources: sdk.js`·`host_permissions`(localhost — background 저장용, T23)·popup·background
  ② `src/content.ts` — **바인딩된 오리진에만** `<script src=chrome.runtime.getURL("sdk.js") data-project>` 주입 (확장 자원이라 페이지 CSP script-src 무관, 기존 sdk.js가 `document.currentScript`로 그대로 부트). 경로 A/B 이중 주입 방지
  ③ `src/popup.ts`+`popup.html` — 현재 탭 오리진에 프로젝트 ID·토큰·서버 주소 바인딩(chrome.storage.local, activeTab) — **T23 몫이던 팝업 바인딩을 선행**(주입 검증에 필요)
  ④ `src/binding.ts` — 오리진별 바인딩 저장 모듈 ⑤ `src/background.ts` — 설치 로그만(저장 릴레이는 T23) ⑥ `build.mjs` — 엔트리별 vite lib(IIFE) 빌드 + manifest/popup.html/sdk.js(재사용) 조립 → `dist/`가 unpacked 로드 대상. 신규 번들러 의존성 0(vite 재사용), `@types/chrome`만 devDep 추가.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` 132 passed·`npm run test:e2e` 2 passed 회귀 없음. **실 Chromium(Playwright persistent context + `--load-extension`, channel "chromium" 신 headless)**: 바인딩 저장 → fixture 페이지에서 SDK 호스트 주입·FAB 렌더·패널 오픈 확인, 패널은 "불러오기 실패" 표시(정상 — API 릴레이 전), **미바인딩 오리진 미주입** 확인. 스크래치 스크립트, 커밋 안 함.
- 참고: 구 headless shell은 확장 미지원 — `channel: "chromium"` 필요 (킥오프 §7 참고 문구 실측 확인). 빈 background.js는 SW 등록이 안 잡혀 onInstalled 리스너 1개 추가.
- 다음 할 일: **T23 background 저장 릴레이** — SDK api 계층에 transport 훅(페이지 → content script postMessage → background fetch(serverUrl+Bearer)) + `lastSeenOrigin` 스탬프. 팝업 바인딩은 T22에서 선행 완료.
- 막힌 지점: 없음.

### 2026-07-11 — T21 콘솔 온보딩 3번째 선택지 완료
- 브랜치: `feat/s25-console-onboarding-t21` (T19→T20 위에 스택) → `main` 병합 완료(2026-07-11, T19~T21 스택 fast-forward)·push. 병합 후 세 브랜치 삭제.
- 완료(서버): ① `POST /projects`의 JSON 분기에 `source:"snippet"` 라우팅 — `handleSnippetRegistration`(이름 검증→생성→토큰 발급→201 `{project, token}`, 오리진 검증·도달성 없음 — fetch하지 않는 경로) ② `POST /projects/:id/token`(재발급, 201 `{token}`, 구 토큰 즉시 무효)·`DELETE /projects/:id/token`(폐기, 204) — 경로 D 한정(그 외 400).
- 완료(콘솔): ① 3번째 탭 **[내 화면에서 편집 (확장)]** — 이름 입력→생성→**토큰 1회 표시**(복사 버튼, 프로젝트 ID, unpacked 로드·팝업 연결 안내) ② 목록 뱃지 "확장"·`lastSeenOrigin` 메타 ③ snippet 프로젝트 액션: 편집 열기 대신 **[토큰 재발급]**(confirm→새 토큰 prompt 표시) ④ **T20 넘김 사항 해소** — 내보내기·마스킹 적용 시 `snippetAuthHeaders`가 토큰을 물어(sessionStorage 세션 보관) Bearer로 전송, 401이면 보관 토큰 폐기+재입력 유도.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **132 passed**(+6: snippet 등록 201+응답 토큰 실동작 / 이름 없음 400 / 재발급 구토큰 401·신토큰 200 / 폐기 후 401 / upload에 토큰 API 400 / 콘솔 3택 HTML). `npm run test:e2e` 2 passed 회귀 없음. **실 Chrome**: 콘솔 3번째 탭 렌더·폼·안내 확인(제출 흐름은 vitest가 커버).
- 다음 할 일: **T22 확장 스캐폴드 + content script SDK 주입** — MV3 manifest·기존 sdk.js 번들 재사용·unpacked 로드로 임의 페이지에 FAB·패널 (pathD 킥오프 §2·§7).
- 막힌 지점: 없음.

### 2026-07-11 — T20 저장 경로 토큰 인증 완료
- 브랜치: `feat/s25-save-auth-t20` (`feat/s25-token-model-t19` 위에 스택, main 미병합 — T19→T20 순 병합 대기).
- 완료: ① `errors.ts`에 `UNAUTHORIZED(401)` 추가(ID-10 확장 여지대로) ② `routes/projects.ts::requireSnippetToken` 미들웨어 — `snippet` 프로젝트의 **PUT/assets/export**에만 `Authorization: Bearer` 검증(불일치·부재 401), upload·proxy 프로젝트는 기존 무인증 그대로(ID-03 same-origin 전제 유지). GET(초기 로드)·목록·삭제는 게이트 밖(스펙 §6 — 저장 계열만).
- 보류(의도): `lastSeenOrigin` 스탬프는 T23으로 — 확장 background 경유 저장은 Origin이 `chrome-extension://`이라 페이지 오리진 전달 방식(헤더 등)이 확장 구현에서 정해진 뒤에 넣는 것이 맞음.
- **T21 넘김 사항**: 콘솔(루트 도메인)의 내보내기 버튼은 토큰이 없어 snippet 프로젝트에서 401이 됨 — 스펙(§6)이 export 토큰 필수를 명시하므로 게이트는 유지, 콘솔 UX(버튼 숨김 또는 "확장에서 내보내기" 안내)는 T21에서 처리.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **126 passed**(+6: PUT 401→Bearer 200 / assets 401→201 / export 401→200 / 타 프로젝트 토큰 401 / GET 무토큰 통과 / upload 프로젝트 무인증 회귀 없음). `npm run test:e2e` 2 passed 회귀 없음.
- 다음 할 일: **T21 콘솔 온보딩 3번째 선택지** — `[내 화면에서 편집 (확장)]` 폼, `POST /projects`에 `{name, source:"snippet"}` 수용+토큰 발급 응답, 설치·토큰 안내, 목록 뱃지, snippet 내보내기 UX(위 넘김 사항).
- 막힌 지점: 없음.

### 2026-07-11 — T19 데이터 모델 + 토큰 발급/검증 완료
- 브랜치: `feat/s25-token-model-t19` (main 미병합, 동의 대기).
- 완료: **shared** — `SnippetMockupSource`(`type:"snippet"`, `registeredAt`, `lastSeenOrigin?`)를 `MockupSource` union에 추가, index export. 전부 optional/변형 추가라 `version: 1` 유지.
- 완료: **server/store** — ① `paths.ts::tokenFile`(projectDir 하위 `token.json` — spec.json 밖, PUT 전체 교체와 격리) ② `tokenStore.ts` 신설: `issueToken`(`tok_`+192bit base64url, **SHA-256 해시만 보관**, 평문 1회 반환, 재발급 시 구 토큰 즉시 무효), `verifyToken`(timingSafeEqual, 미발급·불일치 false), `revokeToken`, `hasToken` ③ `projectStore.createProject`에 `{type:"snippet"}` 분기.
- 확인: `serve.ts`·`console.ts`의 `mockupSource.type` 분기는 if 기반이라 신규 변형에 타입 안전 — snippet 프로젝트의 서빙·콘솔 표시는 T21 몫.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **120 passed**(+7: shared 계약 snippet 왕복·토큰 필드 부재 1 / tokenStore 6 — 발급·검증·오토큰 거부 / 메타에 평문·해시 격리(spec.json에 미포함) / 재발급 무효 / 폐기·hasToken / 프로젝트 삭제 시 정리 / snippet 생성 왕복 무손실). `npm run test:e2e` 2 passed 회귀 없음.
- 다음 할 일: **T20 저장 경로 토큰 인증** — 경로 D 프로젝트의 PUT/assets/export에 Bearer 게이트(401), 타 프로젝트 토큰 거부 (pathD 킥오프 §4.1, technical-spec §6 예외 문단).
- 막힌 지점: 없음.

### 2026-07-11 — 경로 D 확정 승격 (주입=옵션 E 확장, 사용자 결정) + docs/ 동기화 → S2.5 개시
- 브랜치: `docs/pathD-kickoff-draft` → `main` 병합 완료(2026-07-11, fast-forward)·push. 병합 후 브랜치 삭제 (초안·확정 커밋 2건 포함).
- 사용자 결정: **주입 메커니즘 = 옵션 E(브라우저 확장)**. 옵션 S(스니펫)는 범위 밖(후속 실수요 판단).
- 완료: `guide/pathD-kickoff-spec.md` **초안→확정 승격** — §8 결정 5건 해소(①E 확장 ②토큰=별도 메타 파일 해시·만료 없음·수동 재발급 ③unpacked 로드 ④동결 cross-origin 완화 범위 밖 ⑤로드맵 S2.5). 파생 단순화: 저장 CORS 미구현(background 경유라 불필요 — S 도입 시에만). §9 이력 기록.
- 완료: **docs/ 동기화** — PRD(§4.2 경로 D를 "클라이언트 주입(확장)"으로 재정의+결정 플로우에 "로그인해야 보인다" 분기, FR-ONB-06 재정의, §5 우선순위 주석, §7.1 로드맵에 S2.5 행 신설·S2 "구현 완료·실사용 판정 대기"), detailed-spec(§2.3에 [S2.5] 3번째 선택지), technical-spec(§2 데이터 모델 snippet 변형, §6 토큰 인증 예외+`POST /projects/:id/token`, §7.3 신설(SSRF 표면 없음·저장 토큰·CORS 미구현·CSP 무관), §9.2에 T19~T25), docs/README(guide 목록 5번).
- 검증: 문서만 변경.
- 다음 할 일: **T19 구현부터** — 브랜치 `feat/`로 분리, `snippet` 변형 + 토큰 발급/해시검증/폐기 (pathD 킥오프 §4.1·§5). 이 문서 브랜치의 main 병합은 사용자 동의 대기.
- 막힌 지점: 없음.

### 2026-07-11 — 경로 D(클라이언트 주입) 실수요 발생 + 킥오프 초안 작성
- 브랜치: `docs/pathD-kickoff-draft` (main 미병합). 초안 문서만 추가 — docs/ 동기화는 §8 확정 후로 보류.
- 배경(실수요): 경로 B 실사용 중(hana-color.vercel.app 등록·편집·동결까지 실측 성공) 사용자가 **"직접 로그인해 둔 상태의 화면을 쓰고 싶다"**는 요구 제기. 경로 B(서버 프록시)는 익명 fetch라 원리상 불가(외부 IdP 리다이렉트 502). 이는 **PRD 리스크 R5가 예고한 "안 풀리는 인증은 경로 D로 우회"** 지점 — S2 종료 후 실수요 판단 시점 도달(PRD §265).
- 완료: `guide/pathD-kickoff-spec.md` **초안** — S2 킥오프와 동일 형식. 핵심: ① 아키텍처 차이(서버 프록시 vs 클라이언트 주입) ② **주입 메커니즘 갈림길**(옵션 S 스니펫=가볍지만 CSP 못 뚫음 / 옵션 E 확장=content script로 CSP·CORS 우회, 로그인 실화면 커버, 착수 비용 큼 → **초안 권장 E 주+S 보조**) ③ SSRF는 사라지고 **저장 엔드포인트 토큰 인증+CORS**가 새 표면 ④ 마스킹·편집·동결·뷰어·export는 S1/S2 재사용(설계 원칙 #3) ⑤ 데이터 모델 `mockupSource: snippet` 변형(아키텍처 §4 line 131이 예고) ⑥ WBS T19~T25(T19~T21은 메커니즘 무관 선행 가능) ⑦ DoD=로그인 뒤 보호 화면으로 기획서 완성.
- 검증: 문서만. 근거 대조 — 아키텍처 §4(경로 D)·§5.2(경로 D 우회)·line 131(snippet), PRD FR-ONB-06·R5·§265, s2-kickoff §2.1·§4.2.
- 다음 할 일: **§8 결정 대기** — (1) 주입 메커니즘 S/E/단계안 (2) 토큰 저장·수명 (3) 확장 배포 방식 (4) 동결 cross-origin 완화 (5) 로드맵 위치. 사용자가 (1)을 정하면 문서를 확정 승격 → docs/ 동기화 → 구현(T19부터).
- 막힌 지점: 주입 메커니즘 결정이 경로 D 규모를 좌우 — 사용자 판단 필요.

### 2026-07-11 — T18 CI 파이프라인 완료 + 원격 저장소 개설 (S2 WBS 종료)
- 브랜치: `chore/ci-github-actions-t18` → `main` 병합 완료(2026-07-11, fast-forward)·`origin/main` push. 병합 후 브랜치 삭제.
- 원격 개설: 사용자가 `https://github.com/landfill/draftify-html`(public) 제공. `origin` 추가 후 `main` 초기 push(민감 파일 없음 확인 — `data/`·`.env`·`node_modules` gitignore, 추적 파일에 secret 패턴 0). `package-lock.json` 커밋돼 있어 `npm ci` 가능.
- 완료: `.github/workflows/ci.yml` — 킥오프 s2 §7대로 `npm ci` → typecheck → build → test → **Playwright Chromium 설치** → test:e2e. push(전 브랜치)·PR 트리거. `concurrency`로 같은 ref 진행 실행 취소, 실패 시 playwright-report 아티팩트 업로드. 명령 자체는 러너 중립(원격 이식 대비).
- 검증: **로컬** — typecheck·build·test 113 passed·test:e2e 2 passed(S1+S2) 전부 통과. **원격 첫 실행 green**(run 29108846721, verify job 58s, 전 단계 ✓). 스펙 T18 DoD("원격 개설 후 첫 실행 green") 충족.
- 참고: CI 로그에 `actions/checkout@v4`·`setup-node@v4`가 내부 Node 20 런타임 deprecated 경고 — 액션 자체 런타임 문제(Node 24로 자동 강제 실행), 우리 프로젝트 무관·무해. 후속 액션 메이저 갱신 시 자연 해소.
- 다음 할 일: **S2 WBS 종료.** 이 브랜치 main 병합(동의 대기) → 병합 후 push. 이후는 S2 실사용 판정(프록시 온보딩·마스킹) 또는 S3 계획 입력.
- 막힌 지점: 없음.

### 2026-07-11 — T17 E2E: S2 DoD 시나리오 완료
- 브랜치: `feat/s2-e2e-t17` → `main` 병합 완료(2026-07-11, fast-forward). 병합 후 브랜치 삭제.
- 완료: 
  - `playwright.config.ts`: S2 E2E 테스트를 위해 `webServer.env`에 `MOCKSPEC_PROXY_ALLOWLIST` (localhost, 127.0.0.1) 추가.
  - `e2e/s2-dod.spec.ts`: S2 DoD 요구사항에 맞춘 Playwright 시나리오 작성 완료.
    1. 로컬 내장 http 모듈로 `fixtures/todo-app/dist` 정적 서빙(포트 0)하는 오리진 기동.
    2. 비허용 오리진 및 메타데이터 IP 등록 시도 시 API 단에서 400 거부 확인 (보안 회귀 검증).
    3. 콘솔에서 프록시 기반 프로젝트 URL 등록 및 편집 환경 접근 (SDK 주입).
    4. 장면 등록 및 어노테이션 추가 (프록시 모드에서의 편집 흐름 정상).
    5. 콘솔 마스킹 편집 탭에서 마스킹 규칙(`"보고"` -> `"마스킹결과"`) 추가 및 전체 적용.
    6. export 후 산출물 다운로드하여 file:// 프로토콜에서 완전히 오프라인 상태로 렌더링 검증.
    7. 마커 위치 오차(≤2px) 및 설명 일치 확인, 스냅샷 내 원문 텍스트(`"보고"`) 비존재 및 치환 문자열(`"마스킹결과"`) 존재 검증.
- 검증: `npm run test:e2e` 실행하여 S1, S2 시나리오 모두 성공적으로 통과함 (2 passed).
- 다음 할 일: **T18 CI 파이프라인** — GitHub Actions 연동 여부 및 설정 등 (사용자 결정 필요).
- 막힌 지점: 없음.

### 2026-07-11 — T16 마스킹 기능 완료
- 브랜치: `feat/s2-masking-t16` → `main` 병합 완료(2026-07-11, fast-forward). 병합 후 브랜치 삭제.
- 완료:
  - **`routes/export.ts`**: `buildExportHtml`을 위한 스냅샷 조립 시, `scene.maskedSnapshotAsset`이 존재할 경우 `scene.snapshotAsset`보다 우선하여 선택하도록 로직 수정.
  - **`routes/console.ts`**: 마스킹 규칙(CRUD) 편집 및 전체 적용을 위한 클라이언트 UI 모달 구현. `DOMParser`를 이용해 원문 텍스트 노드 및 주요 속성(`value`, `placeholder` 등)에 규칙을 적용하고 `maskedSnapshotAsset`으로 서버에 업로드한 뒤 저장하는 로직 작성. `exportProject` 실행 시 마스킹 미적용본이 있을 때의 확인 알림 추가.
  - **`export.test.ts`**: 마스킹된 스냅샷이 원본에 우선해 조립되는지 확인하는 통합 테스트 추가.
- 검증: `npm test` **113 passed**. 빌드 및 타입 체크 이상 없음.
- 다음 할 일: **T17 E2E** — Playwright로 S2 DoD 시나리오 작성.
- 막힌 지점: 없음.

### 2026-07-11 — T15 콘솔 온보딩 폼 완료
- 브랜치: `feat/s2-console-onboarding-t15` → `main` 병합 완료(2026-07-11, fast-forward). 병합 후 브랜치 삭제.
- 완료:
  - **`store/projectStore.ts`**: `createProject` 서명을 개선하여 `mockupSource`를 `upload` 또는 `proxy` 형태로 분기.
  - **`routes/projects.ts`**: `POST /projects`에 URL 등록 처리(`handleProxyRegistration`) 구현. 오리진 검증 및 `fetch`를 이용한 도달성 체크 포함.
  - **`routes/console.ts`**: 콘솔 화면에 URL 등록 탭 폼 추가 및 AJAX 제출 처리, 프로젝트 목록에 소스 유형 뱃지 추가.
  - **`store-api.test.ts`**: URL 등록 API 실패(SSRF 차단) 케이스 테스트.
- 검증: `npm test` **112 passed** (+1: URL 등록 오리진 검증 확인).
- 다음 할 일: **T16 마스킹** — 규칙 CRUD 추가 및 마스킹본 생성 로직 구현.
- 막힌 지점: 없음.

### 2026-07-10 — T14 쿠키 재바인딩 완료
- 브랜치: `feat/s2-cookie-rebind-t14` → `main` 병합 완료(2026-07-11, fast-forward). 병합 후 브랜치 삭제.
- 완료: **`routes/proxy.ts`** 프록시 응답 헤더 가공 — 오리진의 `Set-Cookie`에서 `Domain` 속성을 제거(host-only 재바인딩). 프록시 환경이 `http`인 경우 브라우저 저장 거부를 막기 위해 `Secure` 속성도 제거.
- 검증: `npm test` **111 passed**(+1: Set-Cookie 재바인딩 Domain 및 프록시 http 시 Secure 제거 확인).
- 다음 할 일: **T15 콘솔 온보딩 폼** — URL 등록 폼 추가 및 오리진 도달성 확인, `mockupSource.type` 분기.
- 막힌 지점: 없음.

### 2026-07-10 — T13 프록시 코어 + SDK 주입 완료
- 브랜치: `feat/s2-proxy-core-t13` → `main` 병합 완료(2026-07-10, fast-forward, 병합 후 vitest 110 passed 재확인). 병합 후 브랜치 삭제.
- 완료: **`routes/proxy.ts`** (technical-spec §3.3, 킥오프 s2 §2) — transport는 **node:http/https + `lookup: guardedLookup`** 확정(undici 미설치로 global fetch는 IP 고정 불가, s2 §9 기록). ① 요청 전달: hop-by-hop·Host·Accept-Encoding·Content-Length 제거 후 Host=오리진·`Accept-Encoding: identity` 재설정, GET/HEAD는 end·그 외 req.pipe ② HTML만 버퍼링 가공: 오리진 절대 URL→프로토콜 상대(`//{proxyHost}`) 재작성 → SDK 태그 주입(inject.ts 재사용) → Content-Length 재계산. 비HTML은 스트림 통과 ③ 응답 헤더에서 CSP·CSP-Report-Only·X-Frame-Options 제거 ④ 리다이렉트 manual: 오리진 내부는 Location을 프록시 경로로 재작성, 밖이면 502 ⑤ 매 요청 재검증(§4.1 ②): 프로토콜+allowlist 동기 재확인, IP는 guardedLookup이 연결 시 검증·고정.
- 완료(가드·에러 확장): ① `ssrfGuard`에 `MOCKSPEC_PROXY_ALLOW_LOOPBACK` dev/test 스위치 — 127/8·::1·unspecified만 완화(메타데이터·ULA·링크로컬 유지). `isBlockedAddress`/`validateOrigin`/`createGuardedLookup`에 `allowLoopback` 스레딩 ② `errors.ts`에 `BAD_GATEWAY(502)` 추가.
- **실버그(테스트가 잡음)**: IP 리터럴 오리진(`127.0.0.1`)은 Node가 `lookup`을 호출하지 않아 IP 고정 가드가 우회됨(루프백 OFF인데 200 통과). 프록시 핸들러가 리터럴을 `isBlockedAddress`로 **동기 직접 검증**하도록 수정 — hostname 오리진은 기존대로 guardedLookup이 연결 시 검증.
- **타입 수정**: guardedLookup 반환 타입을 Node `net.LookupFunction`으로 정렬(family가 `number|"IPv4"|"IPv6"`라 좁은 시그니처는 http.request의 lookup에 비할당). 통합 콜백 `(err, address|addresses, family?)` 사용.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **110 passed**(+7: 프록시 통합 — 실 업스트림 http 서버(127.0.0.1) 대상. HTML 주입+절대 URL 재작성+CSP/XFO 제거 / JSON 통과 / 내부 리다이렉트 경로 재작성 / 외부 리다이렉트 502 / 예약경로 sdk.js 로컬 서빙 / allowlist 축소 시 502 / 루프백 OFF 시 IP 가드 502). `npm run test:e2e` 1 passed(4.0s) 회귀 없음. 프록시 통합 테스트가 실 소켓 왕복을 구동하므로 별도 런타임 확인 생략.
- 문서 동기화: 킥오프 §2.1(transport 문구·IP 리터럴 주의)·§9(T13 결정 3건), technical-spec §3.3·§7.2(루프백 스위치·hard-deny 목록 보강)·§6(BAD_GATEWAY).
- 다음 할 일: **T14 쿠키 재바인딩** — 프록시 응답의 `Set-Cookie` Domain 제거(host-only)·http일 때 Secure 제거. 현재 T13은 Set-Cookie를 그대로 통과시킴(seam 존재). 킥오프 s2 §4.2.
- 막힌 지점: 없음.

### 2026-07-10 — T12 SSRF 가드 모듈 완료
- 브랜치: `feat/s2-ssrf-guard-t12` → `main` 병합 완료(2026-07-10, fast-forward, 병합 후 vitest 103 passed 재확인). 병합 후 브랜치 삭제.
- 완료: **`packages/server/src/proxy/ssrfGuard.ts`** (킥오프 s2 §4.1, technical-spec §7.2) — transport 비의존 순수 모듈. ① `getAllowlist`/`isAllowlisted` — `MOCKSPEC_PROXY_ALLOWLIST` env 파싱(콤마·trim·소문자), 정확 일치 + `*.` 서브도메인 와일드카드(1단계 이상, 접미 위조 차단), 빈 목록=deny-by-default ② `isBlockedAddress` — hard-deny IP: 0.0.0.0/8·127/8·169.254/16(메타데이터)·::1·::·fe80::/10·fc00::/7(ULA)·IPv4-mapped 언랩·비IP. **사설 대역(10/172.16/192.168)은 미차단**(사내 스테이징) ③ `validateOrigin` — 프로토콜(http/https)→allowlist→resolve→IP 검증, 다중 A레코드 중 하나라도 위험하면 거부, `SsrfError(reason)` ④ `createGuardedLookup` — `dns.lookup` 호환 훅으로 **IP 고정**(매 연결 resolve→검증→안전 IP만 소켓 오픈). 리졸버 주입 가능(테스트는 실 DNS 미접촉).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **103 passed**(+19: allowlist 5, hard-deny IP 3, validateOrigin 7, lookup 훅 4). **실측**: 빌드 산출물의 guardedLookup을 실 `node:http` 요청의 `lookup` 옵션에 꽂아 `localhost`(→127.0.0.1) 연결이 ENOTFOUND로 차단됨을 확인(요청이 서버에 미도달 = 유출 0). 스크래치 스크립트, 커밋 안 함.
- 다음 할 일: **T13 프록시 코어** — transport 확정이 첫 결정(node:http/https + `lookup: guardedLookup` 이 의존성 0·실측 통과라 유력, undici Agent는 패키지 추가 필요). §2.1 "global fetch" 문구를 그 결정에 맞춰 갱신(s2 §9 이력에 이미 재검토 플래그). 이후 HTML 버퍼링·절대 URL 재작성·SDK 주입·CSP/XFO 제거·리다이렉트 manual.
- 막힌 지점: 없음. (transport 선택은 T13 정상 결정 사항)

### 2026-07-10 — T11 shared 타입 확장 완료
- 브랜치: `feat/s2-shared-types-t11` → `main` 병합 완료(2026-07-10, fast-forward, 병합 후 vitest 84 passed 재확인). 병합 후 브랜치 삭제.
- 완료: **shared 타입 S2 확장** (킥오프 s2 §1) — ① `MockupSource`를 discriminated union으로 (`UploadMockupSource | ProxyMockupSource`, proxy는 `originUrl`·`registeredAt`) ② `SpecProject.maskingRules?: MaskingRule[]`(`id`·`find`·`replace`, 평문 부분 일치) ③ `Scene.maskedSnapshotAsset?`·`maskedAt?`. 전부 optional 추가라 `version: 1` 유지. index.ts export에 신규 타입 3종 추가.
- 완료(부수): ① `projectStore.ts::referencedAssets`가 `maskedSnapshotAsset`도 참조로 인정 — 이 수정 없이는 PUT 시 마스킹본이 고아로 오인·삭제됨(ID-11 상호작용, 킥오프 s2 §6에 명시된 유지 사항) ② `sdk/state.test.ts`의 `.originalFilename` 직접 접근을 union 안전 비교로 교체.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **84 passed**(+3: shared 계약에 proxy 소스·마스킹 필드 직렬화 왕복 / S1 형태(S2 필드 없음) spec PUT 왕복 무손실 하위 호환 / 마스킹본 asset 유지→참조 해제 시 삭제·원본 보존). 기존 왕복 무손실 테스트 fixture에 S2 필드 포함. `npm run test:e2e` 1 passed(4.1s) 회귀 없음.
- 다음 할 일: T12 — SSRF 가드 모듈 (allowlist 매칭·hard-deny IP·IP 고정 연결, technical-spec §7.2). **T13(프록시 코어)은 T12 없이 노출 금지.**
- 막힌 지점: 없음.

### 2026-07-10 — S2 킥오프 스펙 초판 작성 + docs/ 동기화
- 브랜치: `docs/s2-kickoff-spec` → `main` 병합 완료(2026-07-10, fast-forward). 병합 후 브랜치 삭제.
- 완료: `guide/s2-kickoff-spec.md` 초판 — 범위는 사용자 확정(경로 B + 필수 보안 + 마스킹 + CI 포함, 경로 D·전이·흐름도·스크린샷 fallback·라벨·이력은 범위 밖). 주요 결정: ① 프록시는 Node 내장 fetch(undici) 직접 구현, HTML만 버퍼링·가공(절대 URL 재작성→SDK 주입→CSP/XFO 스트립), 비HTML 스트림 통과, 리다이렉트는 manual로 클라이언트 왕복(hop별 재검증 대체), WebSocket 미지원 절단 ② SSRF는 `MOCKSPEC_PROXY_ALLOWLIST` env(deny-by-default) + hard-deny IP(메타데이터·루프백·자기 자신, 사설 대역은 예외) + resolve된 IP 고정 연결(DNS rebinding 차단) ③ 쿠키는 Set-Cookie Domain 제거(host-only 재바인딩)+http 시 Secure 제거까지만, SSO는 안 뚫음 ④ 마스킹은 규칙 기반 find→replace(평문 부분 일치, 정규식·클릭 편집기 기각), 콘솔 브라우저 DOMParser로 마스킹본 생성(서버 HTML 파싱 금지), 원본 보존·재마스킹, export는 마스킹본 우선 ⑤ 데이터 모델은 optional 추가만(version 1 유지, S1 파일 호환) ⑥ CI는 GitHub Actions 1본(전제: 원격 개설은 사용자 결정 — 현재 로컬 전용 레포). WBS T11~T18 + S2 DoD(프록시 E2E + 마스킹 원문 0회 + 보안 회귀) 정의.
- 검증: 문서만 변경. 결정 근거는 PRD §4.2·NFR-03, technical-spec §3.3·§7.2, 서비스 아키텍처 가이드 §4·§5, s1-kickoff-spec §11과 대조.
- 완료(추가, 같은 날): **docs/ 동기화** — PRD(§7.1 로드맵 표에 S2 확정 범위·"후속 판단" 행 신설, §5 우선순위 주석: P1 중 S2 확정은 FR-ONB-05·FR-EDT-11뿐), detailed-spec(§2.3 온보딩 경로 선택 폼 구체화, §3.12 마스킹 규칙 기반으로 구체화), technical-spec(§1.3 proxy.ts, §2 데이터 모델에 [S2] 필드 통합·§2.2를 "후속 확장"으로 재명명, §3.3 프록시 상세, §6 API [S2] 표기, §7.2 보안 표 구체화, §9.2 WBS T11~T18·§9.3 S2 DoD 신설, §10 [S2] 확정 결정 3행), docs/README(guide 목록에 s2-kickoff-spec).
- 다음 할 일: 구현 T11(shared 타입 확장)부터 — 브랜치 분리(`feat/`), 킥오프 s2 §8 의존 순서대로.
- 막힌 지점: T18(CI)은 원격 저장소 개설 여부·호스팅(GitHub 여부)이 사용자 결정 사항. 워크플로우 파일 작성 자체는 가능.

### 2026-07-10 — S1 실사용 판정 기록 → S1 종료
- 브랜치: `docs/s1-verdict` (main 미병합, 동의 대기).
- 완료: 킥오프 스펙 §11에 **S1 실사용 판정 "가능"** 기록 — 사용자가 실제 목업으로 기획서 1부를 목업 팀 도움 없이 완성. 최초 시도에서 발견된 편집 UX 5건(마커 고정 위치·중복 생성·핀 먼저 워크플로우·패널 스크롤·내보내기 동선)은 4~6차 개정 + fix로 당일 반영, 재검증 통과로 확정. S2 계획 입력(온보딩 경로 B/D 우선순위, zip 마찰 해소 확인)도 함께 기록.
- 검증: 문서만 변경. §10 DoD의 마지막 조건(판정 기록) 충족 — **S1 종료.** S2 우선순위는 경로 B(URL 프록시)로 결정(사용자, 같은 날), 킥오프 §11 S2 입력에 근거·비용과 함께 기록.
- 다음 할 일 (새 세션 시작점): **S2 계획 수립.** 우선순위는 경로 B(URL 프록시)로 결정됨 — 킥오프 §11 "S2 계획 입력"에 근거·비용 기록. 진행 방식은 S1과 동일: ① S2 킥오프 스펙(범위·결정·WBS)을 guide/에 작성 → ② docs/ 동기화 → ③ 구현. 참조: PRD §4.2(경로 B)·FR-ONB-05·NFR-03(SSRF), technical-spec §3.3(프록시 설계 초안)·§7.2, 리스크 R5. 선택 과제: CI 파이프라인(현재 테스트 로컬 실행만).
- 막힌 지점: 없음.

### 2026-07-10 — 편집 화면 내보내기 버튼 (실사용 3회 피드백 ②, 킥오프 §11 6차 개정)
- 브랜치: `feat/editor-export` (`fix/panel-scroll` 위에 스택) → `main` 병합 완료(2026-07-10, fix→feat 순 fast-forward). 병합 후 두 브랜치 삭제.
- 배경: 내보내기가 콘솔에만 있어 편집 후 목록 화면으로 빠져나가야 다운로드 가능 — 편집→확인 루프를 끊는 동선. export 엔드포인트는 이미 same-origin 프록시로 서브도메인에 열려 있어 **서버 변경 없음**.
- 완료: 패널 하단 고정 푸터에 **[내보내기 (HTML 다운로드)]** 버튼 — 콘솔과 동일 규칙(스냅샷 없는 장면 N개 확인 다이얼로그, 50MB 경고는 버튼 아래 힌트), `api.ts::exportProjectHtml`(+`filenameFromDisposition` — filename* 한글 우선, ASCII fallback), blob 다운로드. 프로젝트 로드 전·진행 중 비활성. detailed-spec §3.9 신설(기존 3.9~3.11 → 3.10~3.12 밀림, technical-spec 교차 참조 1건 갱신 — 기존 §3.10 오참조도 함께 수정).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **81 passed**(+2: 내보내기 버튼 → confirm 경유 → export POST → filename* 파일명으로 다운로드 트리거 / confirm 취소 시 미호출), `npm run test:e2e` 1 passed(4.1s).
- 다음 할 일: 실사용 재검증(패널 스크롤·편집 내보내기·미작성 핀·마커 드래그) → 판정 기록(킥오프 §11) → S2 계획.
- 막힌 지점: 없음.

### 2026-07-10 — 패널 스크롤 결함 픽스 (실사용 3회 피드백 ①)
- 브랜치: `fix/panel-scroll` → `main` 병합 완료(2026-07-10, feat/editor-export와 함께 fast-forward).
- 완료: `.panel`(fixed, flex column)에 스크롤 영역이 없어 어노테이션이 늘어나면 아래 내용이 화면 밖으로 밀려나 접근 불가하던 결함 수정 — head·모드 토글 아래를 `.panel__body`(flex:1, min-height:0, overflow-y:auto)로 감싸 해당 영역만 스크롤.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` 79 passed. CSS 레이아웃이라 자동 검증 한계 — 실 Chrome 확인은 사용자 재검증에 포함.
- 다음 할 일: 없음 (feat/editor-export에서 이어짐).
- 막힌 지점: 없음.

### 2026-07-10 — 실사용 2회 피드백: 빈 어노테이션 자동 삭제 철회 → 미작성 핀 (킥오프 §11 5차 개정)
- 브랜치: `feat/empty-ann-pins` → `main` 병합 완료(2026-07-10, fast-forward). 병합 후 브랜치 삭제.
- 배경: 4차 개정의 "빈 어노테이션 선택 해제 시 자동 삭제"가 실사용에서 "요소를 차례로 찍어두고 내용을 한 번에 작성"하는 워크플로우와 정면 충돌(연속 클릭 시 이전 핀이 계속 소멸, 번호만 증가). 오클릭 잔재의 주범(중복 생성)은 4차 ②(클릭=선택)가 이미 해결하므로 자동 삭제를 철회하고 가시화+사용자 주도 정리로 대체.
- 완료: ① 자동 삭제 effect 제거 — 빈 어노테이션은 "미작성 핀"으로 유지, title placeholder 원복 ② 미작성 구분 스타일 — 마커 `marker--empty`(반투명)+툴팁, 목록 `ann--empty`(점선 테두리) ③ 패널 [빈 어노테이션 정리 (N)] 버튼 — 현재 장면의 미작성 핀 일괄 삭제(확인 1회, 미작성 0개면 버튼 숨김). `state.ts::isEmptyAnnotation`/`deleteEmptyAnnotations` 신설. 장면 전환·패널 닫기 시 선택 해제는 유지(다른 장면 소속 선택 잔류 방지 목적).
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **79 passed**(테스트 교체 1+신규 1: 연속 클릭 시 핀 2개 유지+번호 1·2+미작성 스타일 표시 / 정리 버튼이 미작성만 삭제+버튼 카운트+정리 후 숨김), `npm run test:e2e` 1 passed(4.1s). 테스트 픽스처의 `#root`에 `data-mockspec-root` 마킹 추가(main.tsx 실제 호스트와 동일 — 패널 클릭이 부착 시퀀스에 오탐되던 테스트 결함 수정).
- 다음 할 일: 실사용 재검증(핀 먼저·작성 나중 워크플로우, 마커 드래그 체감 포함) → 판정 기록(킥오프 §11) → S2 계획 입력.
- 막힌 지점: 없음.

### 2026-07-10 — 실사용 피드백 반영: 마커 드래그 + 부착 UX (킥오프 §11 4차 개정)
- 브랜치: `feat/marker-drag-attach-ux` → `main` 병합 완료(2026-07-10, fast-forward). 병합 후 브랜치 삭제.
- 배경: 사용자 실사용 1회에서 피드백 2건 — (a) 마커가 요소 우상단 고정이라 위치 조정 불가, (b) 클릭=생성 방식의 중복 생성·오클릭 잔재 혼란. 대안 검토 후 "클릭=생성 유지 + 기존 요소 클릭은 선택(Shift+클릭=추가) + 빈 어노테이션 자동 정리 + 마커 드래그" 채택(핀 도구 분리·확인 팝오버는 매 부착 비용으로 기각). 규약 §4 절차: 킥오프 §5·§6.2·§11(4차 개정) → detailed-spec §3.3/§3.4/§3.5·technical-spec 데이터 모델 동기화 → 구현.
- 완료: **`Annotation.markerOffset?: {dx,dy}`**(shared) — 절대 좌표가 아닌 기본 위치(요소 우상단) 기준 상대 오프셋이라 앵커 재해석(요소 추적)과 공존. SDK 마커 pointerdown 드래그(편집 모드 한정, 이동 임계값 4px로 클릭/드래그 구분, 드래그 직후 click 억제 플래그는 setTimeout 0으로 해제해 잔류 방지), viewer도 동일 오프셋 적용(SDK↔산출물 대칭).
- 완료: **부착 UX** — 편집 모드 클릭 시 대상 요소에 현재 장면 어노테이션이 있으면(resolveAnchor 요소 동일성 비교) 선택으로 전환, Shift+클릭은 강제 생성. title·description 모두 공백인 어노테이션은 선택 해제 시(다른 선택·장면 전환·패널 닫기) 자동 삭제 — 소비 번호는 재사용 안 함(기존 규칙 유지). 패널 힌트·title placeholder("비워두면 선택 해제 시 자동 삭제")로 안내.
- 검증: `npm run typecheck`·`npm run build` exit 0, `npm test` **78 passed**(+3 App 통합: 중복 방지+Shift 추가 / 빈 어노테이션 자동 정리+번호 미재사용 / 드래그 오프셋 커밋+임계값 이하 무시. store-api 왕복 fixture에 markerOffset 포함해 서버 무손실 확인), `npm run test:e2e` 1 passed(4.0s — 기본 위치 오차 ≤2px 회귀 없음). **실 Chrome 드래그 검증은 미수행** — 드래그 UX 체감(관성·겹침)은 다음 실사용에서 확인 요망.
- 다음 할 일: 실사용 재검증(마커 드래그·부착 UX 포함, 실 Chrome 드래그 체감 확인) 후 판정을 킥오프 §11에 기록 → S2 계획 입력.
- 막힌 지점: 없음.

### 2026-07-10 — 루트 README.md 사용 가이드 신설
- 브랜치: `docs/root-readme-usage-guide` → `main` 병합 완료(2026-07-10, fast-forward). 병합 후 브랜치 삭제.
- 배경: 실사용 판정을 앞두고 "서버 실행·사용 방법"이 어느 문서에도 없음을 확인 — 기존 문서는 전부 만드는 사람 관점(스펙·규약·진행 로그). 가이드 부재 시 실사용에 "저장소를 아는 사람"의 도움이 필요해져 S1 취지(목업 팀 도움 없이)와 어긋남.
- 완료(추가, 브랜치 `docs/readme-subdomain-wording` → main 병합 2026-07-10): §1 서브도메인 불릿을 자동 동작 톤으로 다듬고 격리·절대경로 근거 한 줄 요약 — 작업 지시처럼 읽힌다는 사용자 피드백 반영.
- 완료: 루트 `README.md` 신설 — 요구 환경, 서버 실행(PORT·MOCKSPEC_DATA_DIR env), 목업 zip 준비(빌드 산출물·언랩·200MB·base 조건), 업로드→편집(장면 등록·어노테이션·모드·자동 저장), 내보내기→file:// 검증 체크리스트, 테스트 명령, 저장소 구조. `docs/README.md` 서두에 상호 링크 추가.
- 검증: 문서만 변경 — 코드·테스트 무영향. 가이드 내용은 detailed-spec §2~4·technical-spec §3·킥오프 §4와 대조해 작성.
- 다음 할 일: 실사용 1회(팀 내 실제 목업으로 기획서 1부) → "목업 팀 도움 없이 가능했는가" 판정을 킥오프 스펙 §11에 기록 → S2 계획 입력.
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
