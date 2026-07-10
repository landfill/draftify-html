# S2 킥오프 스펙 — 경로 B(URL 프록시) + 마스킹 + CI

> 작성일: 2026-07-10
> 선행 문서 (필독 순서):
> 1. [s1-kickoff-spec.md](./s1-kickoff-spec.md) — S1 확정 사양과 §11 실사용 판정 (S2의 입력)
> 2. [mockup-as-spec-service-architecture.md](./mockup-as-spec-service-architecture.md) §4(경로 B)·§5(보안)
> 3. 이 문서 — S2 구현을 위한 **확정 사양**
>
> **이 문서의 지위**: S1 킥오프 스펙과 동일 — 아래 "결정" 항목들은 재검토 대상이 아니라
> 확정 사항이다. 구현 중 결정을 뒤집어야 할 근거가 발견되면, 임의로 이탈하지 말고 이
> 문서를 먼저 수정하고 그 이유를 §9 결정 변경 이력에 기록한 뒤 진행한다.
> S1에서 확정된 사양(s1-kickoff-spec.md §1~§9)은 이 문서가 명시적으로 언급하지 않는 한
> **전부 그대로 유지**된다.

---

## 0. S2 한 줄 정의

> **이미 URL로 떠 있는 목업을 zip 없이 등록하면 서비스 안에서 열리고,
> 어노테이션을 달아, 실데이터를 마스킹한 단독 실행 HTML 기획서로 내보낼 수 있다.**

검증 질문: **"스테이징·개발 URL로만 존재하는(SSR 포함) 목업을 zip을 만들지 않고
기획서로 만들 수 있는가"**

근거(S1 실사용 판정의 S2 계획 입력, s1-kickoff-spec §11):
- 실사용에서 "index.html이 없는(SSR·dev 서버 전용) 목업은 어떻게 쓰나"는 질문이 바로 나옴
- 현실 목업 대부분이 이미 스테이징·개발 URL로 존재 — 경로 B가 이를 커버
- 편집기·동결·저장·뷰어는 무변경 (온보딩 계층만 추가)

**S2 범위 (2026-07-10 사용자 확정):**

| 포함 | 근거 |
|------|------|
| 경로 B — URL 등록 → 리버스 프록시 + SDK 주입 (§2~§3) | 우선순위 결정 (s1-kickoff-spec §11) |
| SSRF 방어 + 인증 쿠키 재바인딩 (§4) | technical-spec §7.2 — "프록시 경로를 여는 순간 필수" |
| 마스킹 편집 (§5) | 같은 §7.2 — 프록시 목업은 실데이터를 담을 수 있어 반출 방지 필수 |
| CI 파이프라인 (§7) | 프록시·보안 코드 유입으로 회귀 안전망 가치 상승 |

**S2 범위 밖 (구현 금지 — 후속 판단):**
경로 D(로컬 스니펫 — B 이후 실수요를 보고 판단, s1-kickoff-spec §11), 경로 C(레포 빌드, S3),
장면 전이·흐름도, 스크린샷 fallback, 작성자 라벨·산출물 이력, LLM 초안(S3), 실시간 협업.
로드맵 전체 제외 항목(PPT 등 비HTML 산출물, 크롤러 시딩, SSO 조건부)은 S1 킥오프 §0 그대로.

---

## 1. 결정: 데이터 모델 확장 (packages/shared/src/types.ts)

기존 필드의 의미 변경 없음. 추가만 한다.

```typescript
// SpecProject.mockupSource — discriminated union으로 확장
mockupSource:
  | { type: "upload"; originalFilename: string; uploadedAt: string }   // S1 그대로
  | { type: "proxy"; originUrl: string; registeredAt: string };        // S2 신규

// SpecProject에 추가
maskingRules?: MaskingRule[];        // 마스킹 규칙 (§5). 없으면 마스킹 미사용

export interface MaskingRule {
  id: string;                        // "msk_" + nanoid(10)
  find: string;                      // 찾을 문자열 (평문 부분 일치 — 정규식 금지, §5)
  replace: string;                   // 치환 문자열 (빈 문자열 허용)
}

// Scene에 추가
maskedSnapshotAsset?: string;        // 마스킹 적용본 asset 키 (§5). 원본(snapshotAsset)은 보존
maskedAt?: string;                   // 마스킹본 생성 시각 (ISO 8601)
```

- `version: 1` 유지 — 추가 필드는 전부 optional이라 기존 spec.json과 호환된다.
  (S1 파일을 S2 서버가 읽고 그대로 저장해도 무손실)
- technical-spec §2.2의 S2 확장 예정 필드 중 `transition`·`Policy`·`Export`·`members`는
  범위 밖이므로 **추가하지 않는다**.

---

## 2. 결정: 리버스 프록시 (server/routes/proxy.ts)

### 2.1 라우팅과 요청 전달

- S1의 Host 헤더 분기(`{projectId}.localhost:4000`)를 그대로 재사용한다.
  `mockupSource.type === "proxy"`인 프로젝트는 정적 서빙 대신 프록시 핸들러로 분기.
- `/__mockspec/*` 예약 경로(SDK 자산·API)는 프록시 **앞**에서 가로챈다 — S1과 동일하게
  서비스가 응답하고, 오리진으로 전달하지 않는다.
- 업스트림 요청은 **Node 내장 `http`/`https` 모듈 + `lookup: guardedLookup`** 으로 보낸다
  (§9 T13 확정 — global fetch는 undici 미설치로 IP 고정이 불가능해 배제). 프록시 라이브러리
  (http-proxy-middleware 등)는 도입하지 않는다 — SSRF 가드(§4.1)의 IP 고정 연결과 HTML 변조
  주입을 라이브러리 후킹으로 구현하는 것이 직접 구현보다 복잡하다.
  - **IP 리터럴 오리진 주의**: 호스트가 IP 리터럴(`127.0.0.1`, `[::1]`)이면 Node가 `lookup`을
    호출하지 않아 가드 훅이 우회된다. 프록시 핸들러가 리터럴 오리진을 `isBlockedAddress`로
    **동기 직접 검증**해 이 갭을 막는다 (hostname 오리진은 `guardedLookup`이 연결 시점 검증).
- 전달 규칙:
  - 메서드·경로·쿼리·요청 본문 그대로 전달 (목업의 자체 백엔드 API 호출도 통과)
  - `Host` 헤더는 오리진 호스트로 교체, `Accept-Encoding: identity`로 강제
    (응답 압축 해제·재압축 로직 제거 — 사내망 전제라 압축 이득보다 단순성 우선)
  - hop-by-hop 헤더(`Connection`, `Keep-Alive`, `Transfer-Encoding`, `Upgrade` 등) 제거
  - 리다이렉트는 `redirect: "manual"` — 3xx `Location`이 등록 오리진 내부면 프록시 경로로
    재작성해 클라이언트에 반환, 오리진 밖이면 502 + "오리진 밖 리다이렉트" 메시지
    (SSRF §4.1의 hop 재검증을 클라이언트 왕복으로 대체 — 서버가 hop을 따라가지 않으므로
    매 hop이 자동으로 신규 요청 검증을 거친다)

### 2.2 응답 처리와 SDK 주입

- `Content-Type: text/html` 응답만 **전체 버퍼링** 후 가공한다 (목업 HTML은 작다).
  그 외(JS·CSS·이미지·API JSON)는 스트림 그대로 통과.
- HTML 가공 3가지 (순서대로):
  1. **절대 URL 재작성**: 본문 내 등록 오리진의 절대 URL(`https://mockup.team-a.internal/...`)을
     프록시 오리진(`http://{projectId}.localhost:4000/...`)으로 문자열 치환.
     HTML 응답만 대상 — JS 파일 내부 문자열까지 잡으려 하지 않는다
     (S1의 base path 결정과 동일한 한계 인식. 절대 self-URL을 JS에 박은 목업이
     실제로 문제가 되면 그때 실수요로 판단)
  2. **SDK 주입**: `</body>` 직전 `<script src="/__mockspec/sdk.js" data-project="{id}" defer>`
     — S1 serve.ts와 동일 규칙·동일 코드 재사용
  3. 응답 헤더에서 `Content-Security-Policy`(-Report-Only 포함)·`X-Frame-Options` 제거,
     `Content-Length` 재계산
- **WebSocket 업그레이드는 지원하지 않는다** (S2 절단). HMR이 도는 dev 서버가 아니라
  스테이징 URL이 대상이라는 전제. WS가 필수인 목업은 콘솔 안내 문구로 한계를 명시하고,
  실수요가 확인되면 경로 D 또는 WS 통과를 그때 판단.

### 2.3 편집기·동결·뷰어 무변경 확인

- 프록시로 열린 목업은 same-origin이므로 SDK·앵커·저장·export가 **코드 변경 없이** 동작한다.
- 동결(single-file-core)은 클라이언트에서 실행되고, 목업 리소스는 프록시 경유
  same-origin이라 fetch 가능. **오리진 밖(외부 CDN 등) 리소스는 CORS로 인라인이 실패할 수
  있다** — 실패 리소스는 스냅샷에서 제거된다(산출물 네트워크 0건 원칙이 시각적 완전성보다
  우선). 동결 배지에 실패 리소스 수를 표기해 사용자가 인지하게 한다.

---

## 3. 결정: 콘솔 온보딩 폼 (detailed-spec §2.3 구체화)

- "새 프로젝트" 폼에 경로 선택을 추가한다: **[zip 업로드] / [URL 등록]** 2택
  (PRD §4.2 결정 플로우 문구를 안내로 노출. 경로 C·D는 선택지에 넣지 않고
  "빌드해서 zip 업로드" / "S2 이후 검토" 안내만).
- URL 등록: `name` + `originUrl` 입력 → `POST /api/projects` (multipart 대신 JSON body).
  서버는 등록 시점에 §4.1 검증(allowlist·IP)을 수행하고, 통과하면 오리진에 `GET /`을
  1회 시도해 도달성을 확인한다(실패 시 프로젝트를 만들지 않고 400 + 사유).
- 콘솔 목록에 프로젝트의 소스 유형(zip/URL)과 오리진을 표시한다.
- S1 결정 유지: 콘솔은 프레임워크 없는 정적 HTML 1장. 폼 하나 추가에 React를 들이지 않는다.

---

## 4. 결정: 보안 (technical-spec §7.2 구현)

### 4.1 SSRF 방어 — deny-by-default allowlist

- **allowlist는 서버 env로 관리**: `MOCKSPEC_PROXY_ALLOWLIST` — 콤마 구분 호스트 패턴
  (`mockup.team-a.internal, *.staging.example.com`). 와일드카드는 서브도메인 1단계 이상
  (`*.`) 접두만 지원. **비어 있거나 미설정이면 URL 등록 자체를 400으로 거부** (deny-by-default).
  파일·DB 기반 관리 UI는 만들지 않는다 — 사내 운영자가 env 한 줄로 통제하는 것이 단순하다.
- 검증 시점: ① URL 등록 시(콘솔 폼) ② **매 프록시 요청 시** (등록 후 allowlist가 좁아질 수
  있고, DNS는 매번 다시 풀리므로).
- 매 요청 절차:
  1. 오리진 호스트가 allowlist에 매칭되는지 확인
  2. DNS resolve 후 결과 IP를 검증: 루프백(127.0.0.0/8, ::1)·링크로컬/클라우드 메타데이터
     (169.254.0.0/16, fd00::/8 포함 ULA)·서비스 자신의 바인드 주소는 **allowlist와 무관하게
     차단** (hard-deny)
  3. 업스트림 연결은 **검증된 IP로 고정**(undici 커넥션에 resolve 결과를 사용, Host 헤더만
     원 호스트) — 검증과 연결 사이의 DNS rebinding 차단
  - 예외: 사설 대역(10/8, 172.16/12, 192.168/16)은 hard-deny하지 **않는다** — 사내 스테이징이
    바로 그 대역에 있다. allowlist 명시가 곧 허용 의사다.
- 프로토콜은 `http:`·`https:`만. 포트는 URL에 명시된 것만 사용.

### 4.2 인증 쿠키 재바인딩

- 오리진 응답의 `Set-Cookie`에서 **`Domain` 속성을 제거**한다 (host-only 쿠키로 재바인딩 —
  프록시 서브도메인에 귀속). `Path`는 유지.
- 프록시가 http(로컬 4000)일 때는 `Secure` 속성도 제거한다 (붙어 있으면 브라우저가 저장 거부).
- 클라이언트 → 오리진 방향 쿠키는 그대로 전달.
- **여기까지만 한다.** SSO 콜백 URL 불일치 등으로 안 풀리는 인증은 프록시로 뚫으려 하지
  않는다 (서비스 아키텍처 가이드 §5.2 — 비용 대비 무익). 콘솔 안내: "로그인이 SSO 콜백으로
  이동하는 목업은 아직 지원되지 않습니다".

### 4.3 스냅샷의 실데이터 (마스킹으로 대응)

- 프록시 목업의 스냅샷에는 스테이징 실데이터가 포함될 수 있다. 반출 방지는 §5 마스킹이
  담당한다. SDK가 서버로 보내는 데이터 범위는 S1 그대로 (spec + 명시적 동결 스냅샷뿐,
  NFR-04).

---

## 5. 결정: 마스킹 편집 (detailed-spec §3.12 구체화)

### 5.1 방식 — 규칙 기반 치환

- **프로젝트 단위 find→replace 규칙 목록** (`maskingRules`, §1). 콘솔의 프로젝트 항목에
  [마스킹] 편집 화면: 규칙 테이블(추가·수정·삭제) + 장면별 적용 미리보기.
- `find`는 **평문 부분 일치**로만 동작한다. 정규식은 지원하지 않는다 — 기획자 사용자에게
  정규식 오류·과잉 매칭 디버깅을 지우는 비용이 이득보다 크다. 같은 이유로 요소 클릭 방식의
  스냅샷 직접 편집기도 기각 (마스킹 대상은 "고객명·이메일 등 반복 등장 문자열"이라
  찾기-바꾸기가 자연스럽고, 클릭 편집기는 S2 규모를 넘는 별도 에디터다).
- 치환 대상은 스냅샷 HTML의 **텍스트 노드와 속성값(`value`, `placeholder`, `title`,
  `alt`, `aria-label`)만** — 태그명·구조는 건드리지 않는다.

### 5.2 마스킹본 생성 — 클라이언트에서

- 콘솔(브라우저)이 원본 스냅샷을 fetch → `DOMParser`로 파싱 → 규칙 적용 → 결과를
  `POST /projects/:id/assets`로 업로드 → `Scene.maskedSnapshotAsset`에 기록.
  **서버는 HTML을 파싱하지 않는다** (동결과 동일한 원칙 — 서버는 저장·조립만.
  HTML 파서 의존성도 추가하지 않는다).
- **원본 스냅샷은 보존**한다. 규칙 변경 시 항상 원본에서 재생성 (재마스킹 가능).
  규칙이 바뀌면 기존 마스킹본은 stale — 콘솔이 "규칙이 변경됨, 재적용 필요" 표시
  (`maskedAt`과 프로젝트 `updatedAt` 비교가 아니라, 마스킹 적용 시점에 규칙의 해시를
  함께 저장하는 방식은 과잉 — 규칙 편집 화면에서 [전체 장면에 적용] 버튼을 눌러야
  마스킹본이 갱신된다는 단순 규칙으로 충분).

### 5.3 export 연동

- export 조립 시 장면별로 `maskedSnapshotAsset`이 있으면 **마스킹본을 우선** 사용, 없으면
  원본. 마스킹 규칙이 1개 이상인데 마스킹본이 없는(또는 규칙보다 오래된) 장면이 있으면
  export 전 확인 다이얼로그: "마스킹이 적용되지 않은 장면 N개가 있습니다. 계속할까요?"
  (스냅샷 없는 장면 경고와 동일한 패턴 — 차단이 아니라 확인).
- 산출물·뷰어 구조는 무변경 (뷰어는 어떤 스냅샷이 오는지 모른다).

---

## 6. 결정: Spec API 확장

| 메서드/경로 | 변경 | 비고 |
|---|---|---|
| `POST /projects` | JSON body(`{ name, originUrl }`) 수용 추가 | multipart(zip)와 분기. §4.1 검증 + 도달성 확인 후 생성 |
| `PUT /projects/:id` | 변경 없음 | `maskingRules`는 SpecProject 전체 교체에 포함되어 저장 |
| `POST /projects/:id/assets` | 변경 없음 | 마스킹본도 동일 asset store 사용 |
| `POST /projects/:id/export` | 마스킹본 우선 선택 로직 (§5.3) | 경고 헤더 패턴은 S1 그대로 |
| 프록시 경로 (신규) | `{projectId}.localhost:4000/*` → 오리진 | §2. REST가 아니라 서빙 계층 |

- `mockupSource.type === "proxy"` 프로젝트의 삭제는 S1과 동일 (spec.json + assets 제거.
  해제된 zip 디렉토리가 없을 뿐).
- ID-11(asset 정리) 유지: 마스킹본도 `maskedSnapshotAsset` 참조가 사라지면 정리 대상.

---

## 7. 결정: CI 파이프라인

- **GitHub Actions** 워크플로우 1본: `npm run typecheck` → `npm run build` → `npm test`
  → `npm run test:e2e` (Playwright Chromium 캐시 포함). push·PR 트리거.
- **전제 조건: 이 레포는 현재 원격이 없다 (로컬 전용).** GitHub(또는 사내 GitLab 등) 원격
  개설은 사용자 결정 사항 — 워크플로우 파일은 S2에서 작성해 커밋해두고, 원격이 GitHub가
  아니게 되면 그때 러너 형식만 이식한다 (테스트 명령 자체는 러너 중립).
- E2E의 프록시 시나리오(§8 DoD)는 CI 안에서 fixture 서버를 localhost로 띄워 검증한다 —
  외부 네트워크 의존 없음 (allowlist에 fixture 호스트만 넣은 전용 env로 실행).

---

## 8. S2 작업 분해(WBS)와 완료 기준

S1의 T1~T10에 이어 번호를 붙인다. 의존 순서대로.

| # | 작업 | 완료 기준 (AC) |
|---|------|---------------|
| T11 | shared 타입 확장 (§1) | mockupSource union·maskingRules·maskedSnapshotAsset 추가, 기존 S1 spec.json 로드·저장 왕복 무손실 (vitest) |
| T12 | SSRF 가드 모듈 (§4.1) | allowlist 매칭·hard-deny IP·IP 고정 연결 유닛 테스트. 미설정 시 등록 거부. **T13은 이 모듈 없이 노출 금지** |
| T13 | 프록시 코어 + SDK 주입 (§2) | fixture 서버를 오리진으로 등록 → 프록시 경유로 열리고 HTML에 sdk.js 태그 존재, CSP/XFO 제거, 비HTML 스트림 통과, 오리진 밖 리다이렉트 502 (vitest, supertest + 로컬 fixture 오리진) |
| T14 | 쿠키 재바인딩 (§4.2) | Set-Cookie Domain·Secure 처리 vitest. 쿠키 세션 fixture로 로그인 상태 유지 확인 |
| T15 | 콘솔 온보딩 폼 (§3) | 콘솔에서 URL 등록 → 편집 열기까지 콘솔만으로 가능. 비허용 오리진 등록 시 400 사유 표시 |
| T16 | 마스킹: 규칙 CRUD + 마스킹본 생성 + export 연동 (§5) | 규칙 추가 → [전체 장면에 적용] → export 산출물에서 원문 문자열 0회·치환문 존재 (vitest + 실 Chrome 1회) |
| T17 | E2E: S2 DoD 시나리오 (아래) | `npm run test:e2e`에 프록시 시나리오 추가 통과, S1 시나리오 회귀 없음 |
| T18 | CI 파이프라인 (§7) | 워크플로우 파일 커밋 + 로컬에서 동일 명령 시퀀스 통과 확인. 원격 개설 후 첫 실행 green은 사용자와 함께 확인 |

### S2 Definition of Done

Playwright 자동화 시나리오 (S1 DoD와 별개 spec, 같은 러너):

1. fixture 목업(Todo 앱)을 **로컬 HTTP 서버로 기동** (zip 업로드가 아니라 URL 오리진 역할)
2. 콘솔에서 URL 등록 (allowlist에 fixture 호스트만 든 전용 env) → 편집 화면이 프록시
   경유로 열림 (SDK 주입 확인)
3. 장면 2개 등록·어노테이션 부착·설명 입력 (S1과 동일 편집 플로우가 프록시 위에서 동작)
4. 마스킹 규칙 1건 추가 → 전체 장면 적용
5. export → 새 브라우저 컨텍스트에서 file:// 오픈
6. 검증: 장면 전환·마커 위치(오차 ≤2px)·설명 일치, **마스킹 원문 문자열이 산출물에 0회**,
   네트워크 요청 0건
7. 보안 회귀: 비허용 오리진·메타데이터 IP 등록이 400으로 거부 (API 레벨)

이것이 통과하고, **실사용 1회** — 실제 스테이징 URL로 존재하는 목업 하나로 기획서 1부를
완성 — 에서 "zip을 만들지 않고 가능했는가" 판정을 이 문서 §9에 기록하면 S2 종료.

---

## 9. 결정 변경 이력

| 일자 | 변경 | 이유 |
|------|------|------|
| 2026-07-10 | 초판 확정 — 범위(경로 B + 보안 + 마스킹 + CI)는 사용자 결정 | S1 실사용 판정의 S2 계획 입력 (s1-kickoff-spec §11) |
| 2026-07-10 | T13 확정: **transport = Node `http`/`https` + `lookup: guardedLookup`** (§2.1 문구 갱신, "global fetch(undici)" 배제). 추가 결정 3건: ① **IP 리터럴 오리진 동기 검증** — Node가 IP 리터럴엔 lookup을 안 부르는 갭을 프록시 핸들러의 `isBlockedAddress` 직접 호출로 차단 ② **dev/test 루프백 스위치** `MOCKSPEC_PROXY_ALLOW_LOOPBACK` — 127/8·::1만 완화(메타데이터·ULA·링크로컬 차단 유지), fixture/로컬 dev가 127.0.0.1에 뜨므로 프록시 검증에 필요, 운영 OFF ③ 에러 표준에 `BAD_GATEWAY(502)` 추가 — 오리진 실패·오리진 밖 리다이렉트 (§2.2의 "502" 구현) | global fetch는 소켓 lookup 후킹이 없어 IP 고정 불가(undici 미설치). IP 리터럴 갭은 통합 테스트가 잡음(루프백 OFF인데 200 통과 → 동기 검증 추가). 루프백 스위치 없이는 프록시 경로를 로컬에서 검증 불가. 502는 ID-10이 "4개로 시작"이라 확장 여지를 둔 대로 추가 |
| 2026-07-10 | T12 구현 중 확인: **IP 고정(§4.1)은 `dns.lookup` 호환 훅으로 실현** — SSRF 가드가 `createGuardedLookup`을 노출하고, 연결 계층이 이를 꽂으면 매 연결마다 resolve→검증→안전 IP로만 소켓을 연다. §2.1의 "global fetch(undici)로 요청"은 **재검토 대상** — 확인 결과 undici 패키지가 미설치라 global fetch로는 커스텀 lookup/IP 고정이 불가능. transport(node:http/https + `lookup` 옵션 vs undici Agent 도입)는 **T13에서 확정**하며, 어느 쪽이든 가드 훅은 그대로 재사용된다 (가드는 transport 비의존) | global fetch는 소켓 lookup 후킹 지점이 없어 "resolve된 IP로 고정"을 직접 못 한다. lookup 훅 방식은 의존성 0이고 node:http에 실측 검증됨(localhost→127.0.0.1 연결 차단 확인). §2.1 문구 갱신은 transport를 실제로 고르는 T13에서 함께 처리 |
| | (구현 중 이탈 발생 시 여기에 기록) | |
