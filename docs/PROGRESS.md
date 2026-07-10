# PROGRESS — 작업 진행 로그

> 이 파일은 여러 에이전트·여러 세션에 걸친 작업 인수인계의 단일 진실 공급원이다.
> Claude Code의 개인 메모리(`~/.claude/projects/.../memory/`)는 세션·머신·에이전트 종류가
> 바뀌면 접근할 수 없다. 이 프로젝트에 관한 진행 상태·결정·다음 할 일은
> 전부 이 파일(과 `docs/`의 스펙 문서)에 남긴다. 개인 메모리에는 남기지 않는다.
>
> 갱신 규약은 [AGENTS.md](../AGENTS.md) §3 참조.

## 현재 단계

**S2 구현 중 (2026-07-10) — T11·T12·T13 완료(T13은 `feat/s2-proxy-core-t13`, main 병합 대기). transport=node:http/https+lookup 확정, §2.1·§7.2 문서 동기화 완료. 다음: T14 쿠키 재바인딩 (킥오프 s2 §8). 새 세션은 여기서 시작.**

## S2 WBS 체크리스트 (킥오프 스펙 §8 — 구현은 docs/ 동기화 후 시작)

- [x] T11 shared 타입 확장 (mockupSource union·maskingRules·maskedSnapshotAsset) — vitest 84 passed, S1 형태 하위 호환·S2 필드 왕복 무손실·마스킹본 ID-11 검증
- [x] T12 SSRF 가드 모듈 (allowlist·hard-deny IP·IP 고정 연결) — vitest 103 passed(+19), lookup 훅이 node:http에서 루프백 연결 차단 실측
- [x] T13 프록시 코어 + SDK 주입 (CSP/XFO 제거, 리다이렉트 정책) — vitest 110 passed(+7), 실 업스트림 프록시 왕복·IP 리터럴 갭 차단 검증
- [ ] T14 쿠키 재바인딩
- [ ] T15 콘솔 온보딩 폼 (URL 등록)
- [ ] T16 마스킹 (규칙 CRUD + 마스킹본 생성 + export 연동)
- [ ] T17 E2E: S2 DoD 시나리오
- [ ] T18 CI 파이프라인 (전제: 원격 저장소 개설 — 사용자 결정)

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

### 2026-07-10 — T13 프록시 코어 + SDK 주입 완료
- 브랜치: `feat/s2-proxy-core-t13` (main 미병합, 동의 대기).
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
