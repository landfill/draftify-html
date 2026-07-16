# 기술 스펙 — Mockup-as-Spec (mockspec)

> 작성일: 2026-07-06
> 문서 지위: 시스템 아키텍처·데이터 모델·API·핵심 알고리즘 사양 (S1 확정 + S2/S3 방향)
> 상위 문서: [PRD.md](./PRD.md) · [detailed-spec.md](./detailed-spec.md)
> 원 결정 문서: [guide/s1-kickoff-spec.md](../guide/s1-kickoff-spec.md) — S1 결정의 원본.
> 이 문서와 킥오프 스펙이 충돌하면 킥오프 스펙 §11 이력에 기록하고 양쪽을 동기화한다.
> 보충 결정: [implementation-decisions.md](./implementation-decisions.md) — 미정의 지점 확정 (ID-01~15)

---

## 1. 시스템 아키텍처

### 1.1 전체 구성

```
┌─────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                         │
│  {projectId}.localhost:4000                                  │
│  ┌──────────────────────────────┬─────────────────────────┐  │
│  │  목업 (정적 호스팅/프록시)     │  Spec Editor SDK        │  │
│  │                              │  (주입됨, Shadow DOM)    │  │
│  └──────────────────────────────┴───────────┬─────────────┘  │
└──────────────────────────────────────────────┼───────────────┘
                                               │ REST (spec CRUD)
        ┌──────────────────────────────────────▼─────────────┐
        │              Spec Service (Express 5)               │
        │  ├─ Gateway/Injector: 정적 호스팅 + SDK 주입         │
        │  │    [S2: + 리버스 프록시]                          │
        │  ├─ Spec API: 프로젝트/장면/어노테이션 CRUD           │
        │  ├─ Asset Store: 업로드 zip, 장면 스냅샷              │
        │  ├─ Export: spec + 스냅샷 → 단독 HTML 번들링          │
        │  └─ 접근 제어: 사내망 + 비추측성 ID (인증 없음)        │
        └────────────────────────────────────────────────────┘
```

### 1.2 기술 스택 (S1 확정 — 킥오프 스펙 §2)

| 영역 | 결정 | 이유 |
|------|------|------|
| 언어 | TypeScript (strict) 전 패키지 공통 | 타입 정의(§2)가 패키지 간 계약 |
| 런타임 | Node.js 20+ | |
| 모노레포 | npm workspaces (turbo/nx 도입 금지) | S1 규모에 도구 오버헤드 불필요 |
| SDK UI | Preact + Shadow DOM | 3KB급 단일 번들, 패널 UI에 JSX 생산성. React는 번들 크기로 배제 |
| SDK 번들 | Vite lib mode → 단일 IIFE `sdk.js` | 주입 한 파일 원칙 |
| 서버 | Express 5 | 팀 경험 재사용. Fastify 등으로 갈아타지 말 것 |
| 저장 | 파일 기반 JSON (프로젝트당 1파일) + 디스크 asset store | S1 단일 편집자 전제, 동시성 불필요. DB는 S2에서 필요 시 |
| zip 처리 | multer(업로드) + unzipper(해제) | |
| DOM 캡처 | `single-file-core` (npm) | 직접 구현 금지 — CSS 인라인/폰트/이미지 처리 재발명은 S1 최대 리스크 |
| 뷰어 | 프레임워크 없는 vanilla TS → 인라인 단일 번들 | 산출물에 통째로 인라인되므로 의존성 최소화 |
| 테스트 | vitest (unit) + Playwright (E2E 1본) | E2E는 DoD 시나리오 그대로 자동화 |

### 1.3 레포 구조

```
mockspec/                        # 신규 레포 (기존 Draftify 코드 이식 금지)
├─ docs/                         # 가이드 3종 + PRD·기획·스펙 문서 복사본
├─ packages/
│  ├─ shared/                    # spec 타입 정의 (§2) — 유일한 계약 소스
│  │  └─ src/types.ts
│  ├─ sdk/                       # Spec Editor SDK (Preact, Shadow DOM)
│  │  ├─ src/
│  │  │  ├─ main.ts              # 진입점: mount, 편집/미리보기 모드 전환
│  │  │  ├─ overlay/             # 마커 렌더, 요소 하이라이트
│  │  │  ├─ panel/               # 우측 패널 (장면 목록, 어노테이션 편집)
│  │  │  ├─ anchor/              # 앵커 생성·재해석 (§4) — viewer와 공유
│  │  │  ├─ freeze/              # single-file-core 래핑 (§5)
│  │  │  └─ api.ts               # Spec API 클라이언트 + localStorage 큐
│  │  └─ vite.config.ts          # → dist/sdk.js (IIFE 1파일)
│  ├─ server/                    # Express: 호스팅+주입, Spec API, Export
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ routes/projects.ts   # 업로드·URL 등록, CRUD (§6)
│  │     ├─ routes/serve.ts      # 목업 서빙 + SDK 주입 (§3)
│  │     ├─ routes/proxy.ts      # [S2] 리버스 프록시 (§3.3) + SSRF 가드 (§7.2)
│  │     ├─ routes/export.ts     # 산출물 조립 (§8)
│  │     └─ store/               # JSON 파일 저장, asset store
│  └─ viewer/                    # 산출물 HTML의 뷰어 (빌드 → server가 템플릿으로 사용)
│     └─ src/main.ts
└─ data/                         # (gitignore) projects/{id}/spec.json, assets/
```

빌드 의존: `shared` → (`sdk`, `server`, `viewer`). `anchor` 모듈은 sdk/viewer가 공유. `viewer` 빌드 산출물은 `server`가 export 시 템플릿으로 읽는다.

워킹네임 `mockspec`은 추후 변경 가능 — 코드 내 하드코딩 금지, 패키지명과 표시 문자열은 상수 한 곳에서 관리.

---

## 2. 데이터 모델 (`packages/shared/src/types.ts`)

SDK↔서버↔뷰어 간 **유일한 계약**. 필드 추가는 자유, 필드 의미 변경은 킥오프 스펙 §11 기록 필수.

```typescript
export interface SpecProject {
  version: 1;
  id: string;                    // "prj_" + nanoid(10)
  name: string;
  ownerLabel?: string;           // 작성자 표시 라벨 — 인증 아님(POL-M09), 콘솔 생성 시 선택 입력 (FR-CON-03)
  createdAt: string;             // ISO 8601
  updatedAt: string;
  mockupSource:                  // [S2] discriminated union으로 확장 (킥오프 s2 §1)
    | { type: "upload"; originalFilename: string; uploadedAt: string }
    | { type: "proxy"; originUrl: string; registeredAt: string }
    // [S2.5] 경로 D — 서버가 fetch할 originUrl 없음 (pathD 킥오프 §5).
    // 토큰은 spec.json에 넣지 않는다(별도 메타 파일에 해시) — PUT 전체 교체와 격리
    | { type: "snippet"; registeredAt: string; lastSeenOrigin?: string };
  sceneCodeSeq: number;          // 다음 SCR-### 번호. 단조 증가 — 삭제된 장면 번호 재사용 방지
  scenes: Scene[];
  annotations: Annotation[];
  maskingRules?: MaskingRule[];  // [S2] 마스킹 규칙 (detailed-spec §3.12). 없으면 마스킹 미사용
}

export interface MaskingRule {   // [S2]
  id: string;                    // "msk_" + nanoid(10)
  find: string;                  // 찾을 문자열 (평문 부분 일치 — 정규식 금지)
  replace: string;               // 치환 문자열 (빈 문자열 허용)
}

export interface Scene {
  id: string;                    // "scn_" + nanoid(10)
  code: string;                  // "SCR-001" — 생성 순 표시 코드, 영구 불변 (output-standard §1.2)
  title: string;                 // 사용자 입력 (패널 인라인 편집. 기본값 document.title은 킥오프 §11 8차에서 철회)
  route: string;                 // 등록 시점 location.pathname+search+hash
  stateNote?: string;            // "모달 열림 상태" 등
  order: number;                 // 패널·뷰어 정렬 기준
  annoNumberSeq: number;         // 장면 내 다음 어노테이션 번호. 현재 남은 최대 번호+1 — 끝 번호 삭제 시 감소 가능
  snapshotAsset?: string;        // asset store 키. 캡처 성공 시에만 존재
  frozenAt?: string;
  captureWidth?: number;         // 캡처 시점 뷰포트 레이아웃 폭(px) — 뷰어가 스냅샷 iframe 기준 폭으로 사용, 반응형 캡처 레이아웃 재현 (킥오프 §11 8차)
  captureHeight?: number;        // 캡처 시점 뷰포트 높이(px) — 100vh류 페이지는 scrollHeight 측정 불가, 캡처 높이로 렌더해야 잘리지 않음 (킥오프 §11 8차)
  maskedSnapshotAsset?: string;  // [S2] 마스킹 적용본 asset 키. 원본(snapshotAsset)은 보존
  maskedAt?: string;             // [S2] 마스킹본 생성 시각 (ISO 8601)
}

export interface Annotation {
  id: string;                    // "ann_" + nanoid(10)
  sceneId: string;
  number: number;                // 장면 내 1부터. 기존 번호는 재정렬하지 않고 신규는 현재 최대+1
  anchor: Anchor;
  title: string;
  description: string;           // 마크다운 허용 (뷰어에서 렌더)
  policyRefs?: string[];         // "POL-014" 등. S1은 저장·표시만
  markerOffset?: { dx: number; dy: number }; // 마커 표시 오프셋(px) — 기본 위치(요소 좌상단, 킥오프 §11 14차 개정)에서 드래그로 옮긴 상대값 (킥오프 §11 4차 개정)
  transition?: { toSceneId: string; condition?: string }; // 흐름도 원천 데이터 — "이 요소 조작 시 → 장면 X" (2026-07-12 §2.2 예정 필드에서 승격, FR-EDT-10)
}

export interface Anchor {
  selector: string;              // 구조적 CSS 셀렉터 (자동 생성)
  text?: string;                 // 요소 textContent 앞 40자 (검증용 시그니처)
  attrs?: Record<string, string>; // aria-label, role, name 등 존재하는 것만
  rect: { x: number; y: number; w: number; h: number }; // 문서(document) 기준 비율(0~1), 최후 fallback — ID-04
}
```

### 2.1 설계 노트

- `Scene.code`·`sceneCodeSeq`·`annoNumberSeq`는 킥오프 스펙 §5 대비 **추가 필드** (필드 추가 자유 조항). 표시 코드 체계는 [output-standard.md](./output-standard.md) §1 참조. `sceneCodeSeq`는 장면 코드 영구 결번을 위해 단조 증가한다. `annoNumberSeq`는 어노테이션 추가 시 현재 장면의 남은 최대 번호에서 다시 계산하며, 최고 번호 삭제 시 감소할 수 있다(킥오프 §11 12차)
- **`data-spec-id`(코어 가이드의 1순위 앵커)는 서비스 모델에서 제외** — 서비스는 목업 소스를 수정하지 않으므로 소스 반영이 불가능. selector+text+attrs 다중 시그니처가 1순위다. (코어 가이드 §4와의 의도적 차이 — "목업 무수정" 제1 기준 우선)
- 저장 파일: `data/projects/{projectId}/spec.json` = `SpecProject` 직렬화 그대로. **이 파일을 그대로 내려주는 것이 export/import(백업)이다.**
- 장면 스냅샷(캡처 DOM)은 수 MB → JSON이 아니라 asset store(디스크)에 두고 `snapshotAsset` 키로 참조.

### 2.2 후속 확장 예정 필드 (구현 금지, 방향만 기록)

아래는 S2 범위 밖으로 확정 (2026-07-10, 킥오프 s2 §0) — S2 종료 후 실수요를 보고 판단.
`Annotation.transition`은 2026-07-12 착수 확정으로 §2 본 모델에 승격 (T26~T28).
`ownerLabel`·산출물 이력은 2026-07-14 착수 확정(사용자 결정)으로 승격 (T29) — 단 이력은
**메타 전용**: `ExportRecord { id, createdAt, specUpdatedAt, bytes, masked }`를 서버 소유
별도 파일 `exports.json`에 기록한다(§6.3). 예정안의 `htmlRef`(산출물 파일 보관)는 **미채택** —
산출물은 수십 MB라 매 export 보관은 저장소 부담이고 재다운로드는 재-export로 충분(YAGNI).
`members[]`도 **보류** — 편집자 1인 규칙(POL-M08)과 겹쳐 실수요 미확인, ownerLabel 1개로 시작.

```typescript
// 신규 엔티티
Policy { id: "pol_"+nanoid(10), code: "POL-###", title, body } // 정책정의서 (output-standard §3.2)
Project.members[]                                              // 다중 작성자 라벨 (보류 — 위 참조)

// [S3] 프로젝트 설정 — LLM 옵트인 (기본 false. POL-M13)
Project.settings?: { llmDraftEnabled: boolean };
```

---

## 3. 목업 서빙과 SDK 주입 (server/routes/serve.ts)

### 3.1 서브도메인 라우팅

- **프로젝트별 서브도메인**: `{projectId}.localhost:4000`. 모던 브라우저는 `*.localhost`를 DNS 설정 없이 127.0.0.1로 해석 — 로컬/사내 S1에 충분.
- 콘솔(관리 UI)은 `localhost:4000` 루트에서 서빙. Express에서 **Host 헤더로 분기**.
- 서브도메인 격리의 효과: 목업 간 localStorage/쿠키 오염 방지, base path 문제 회피 (경로 재작성은 JS 내부 문자열 경로까지 못 잡으므로 채택하지 않음).

### 3.2 서빙 규칙

| 규칙 | 사양 |
|------|------|
| 정적 서빙 | zip 해제 디렉토리(`data/projects/{id}/mockup/`)를 루트로 서빙 |
| SDK 주입 | `text/html` 응답에만 `</body>` 직전 `<script src="/__mockspec/sdk.js" data-project="{projectId}" defer></script>` 삽입. SDK는 `currentScript.dataset.project`로 자기 프로젝트 식별 (ID-03) |
| 예약 경로 | `/__mockspec/*` — SDK 자산 + **same-origin API 프록시** (`/__mockspec/api/*` → Spec API). 목업 파일과 충돌 시 예약 경로 우선 |
| 오리진 규율 | 클라이언트 코드는 상대 경로만, 서버는 Host 헤더 파싱 + `PORT` env — 오리진 하드코딩 금지 (ID-01) |
| SPA fallback | 확장자 없는 404 → `index.html` |
| 업로드 제약 | zip 200MB 제한 (**압축 파일 기준** — multer limits는 해제 전에 걸리므로 제외 필터로는 우회 불가. 콘솔에서 "dist만 압축" 안내). SPA는 상대 base(`vite build --base ./`) 또는 루트 base 빌드만 지원 (콘솔에 안내) |
| 불필요 경로 제외 | 스트리밍 해제 중 엔트리 경로가 제외 목록과 일치하면 스킵 (디스크에 쓰지 않음). 기본 제외: `node_modules/`, `.git/`, `__MACOSX/`, `.DS_Store`, `Thumbs.db`, `*.map`. 제외 결과(`{ pattern, count }[]`)를 업로드 응답에 포함해 콘솔이 표시. unzipper의 entry 스트림에서 `entry.autodrain()`으로 구현 — 비용 거의 없음 |
| 최상위 폴더 언랩 | 해제(제외 필터 적용) 후 모든 엔트리가 하나의 공통 최상위 디렉토리 체인을 공유하면 벗겨서 루트로 승격 (`dist/index.html` → `index.html`). `..`·빈 세그먼트는 접두로 취급하지 않음 — zip-slip 검증은 언랩과 무관하게 유지. 언랩된 접두(`strippedRoot`)를 업로드 응답에 포함해 콘솔이 표시 (킥오프 §11 3차 개정) |
| zip-slip 방지 | 해제 시 경로 정규화 후 프로젝트 디렉토리 밖 기록 거부 — **필수** |

### 3.3 [S2] 리버스 프록시 (경로 B — server/routes/proxy.ts, 킥오프 s2 §2)

- **라우팅**: S1의 Host 헤더 분기 재사용. `mockupSource.type === "proxy"`인 프로젝트는 정적
  서빙 대신 프록시 핸들러로 분기. `/__mockspec/*` 예약 경로는 프록시 **앞**에서 가로챈다
  (오리진으로 전달하지 않음).
- **업스트림 요청**: Node 내장 `http`/`https` + `lookup: guardedLookup` (킥오프 s2 §9 T13 —
  global fetch는 undici 미설치로 IP 고정 불가). 프록시 라이브러리 미도입. 메서드·경로·쿼리·
  본문 그대로 전달(목업 자체 백엔드 API도 통과), `Host`는 오리진 호스트로 교체,
  `Accept-Encoding: identity` 강제(압축 해제·재압축 로직 제거), hop-by-hop 헤더 제거.
  IP 리터럴 오리진은 Node가 lookup을 안 부르므로 `isBlockedAddress`로 동기 직접 검증.
- **리다이렉트**: `redirect: "manual"` — 3xx `Location`이 오리진 내부면 프록시 경로로 재작성해
  클라이언트에 반환, 오리진 밖이면 502. 서버가 hop을 따라가지 않으므로 매 hop이 신규 요청
  검증(§7.2)을 자동으로 거친다.
- **HTML 가공** (`text/html`만 전체 버퍼링, 그 외는 스트림 통과. 순서대로):
  1. 본문 내 등록 오리진의 절대 URL → 프록시 오리진으로 문자열 치환 (HTML만 — JS 파일
     내부까지 잡으려 하지 않음, S1 base path 결정과 동일한 한계 인식)
  2. `</body>` 직전 SDK `<script>` 주입 — §3.2와 동일 규칙·코드 재사용
  3. `Content-Security-Policy`(-Report-Only 포함)·`X-Frame-Options` 응답 헤더 제거,
     `Content-Length` 재계산
- **WebSocket 업그레이드 미지원** (S2 절단) — 스테이징 URL이 대상이라는 전제. WS 필수
  목업은 콘솔 안내 문구로 한계 명시 (detailed-spec §2.3).
- **캡처 시 오리진 밖(외부 CDN) 리소스**는 CORS로 인라인 실패 가능 — 실패 리소스는
  스냅샷에서 제거(네트워크 0건 원칙이 시각적 완전성보다 우선), 캡처 배지에 실패 수 표기.
- 보안 요건은 §7.2

---

## 4. 앵커 생성·재해석 알고리즘 (sdk/anchor — viewer 공유)

### 4.1 대상 요소 선정 (ID-08)

클릭 지점 요소에서 가장 가까운 인터랙티브 조상(`a, button, input, select, textarea, label, [role=button|link|tab], [onclick], [tabindex]`)을 잡는다. 없으면 클릭된 요소 그대로. 부모 확장 UI 없음, 같은 요소 중복 부착 허용.

### 4.2 생성 (ID-06)

1. **selector**:
   - 요소에 문서 내 유일한 id가 있으면 `#id`
   - 아니면 id가 유일한 가장 가까운 조상(없으면 body)을 기준점으로, 기준점→요소까지 `tag:nth-of-type(n)` 체인 (예: `#root > div:nth-of-type(2) > button:nth-of-type(1)`)
   - 생성 후 `querySelectorAll` 유일성 검증, 실패 시 body부터 전체 경로 재생성
   - **클래스 미사용** (CSS-in-JS 해시/유틸리티 클래스의 안정성 판별 복잡도 회피)
2. **text**: `textContent` 앞 40자, 공백 정규화(연속 공백 → 단일, trim)
3. **attrs**: `aria-label`, `role`, `name` 등 존재하는 것만 수집
4. **rect**: 문서 기준 비율 좌표 — `(getBoundingClientRect + scrollX/Y) ÷ (scrollWidth/scrollHeight)` (ID-04)

### 4.3 재해석 (렌더 시마다, ID-07)

```
resolve(anchor):
1. document.querySelector(anchor.selector)
   → 찾았고 text/attrs 시그니처도 일치 → 확정
2. 실패 시 재탐색:
   a. selector 마지막 세그먼트와 같은 tagName 요소 중 normalize(text) 완전 일치 후보 수집
      (text 없는 요소는 attrs만으로)
   b. attrs 저장분이 모두 일치하는 것만 남김
   c. 후보 1개 → 확정 / 여러 개 → rect 중심점 최근접 / 0개 → 2.5로
   → 확정 시 마커 렌더 + anchor.selector 자동 갱신 (저장)
2.5. 재탐색 실패 시, 1의 selector가 문서에서 유일하게 해석되면 그 요소 위치에
   "위치 불확실"(점선) 마커 렌더 (킥오프 §11 15차 — 동적 텍스트로 서명만 불일치한
   요소를 rect보다 우선. selector 갱신·저장은 하지 않는다) / 아니면 3으로
3. 실패 시: anchor.rect의 문서 좌표에 "위치 불확실"(점선) 마커 렌더
   → 조용히 사라지게 두지 않는다. text·attrs 둘 다 없는 요소의 재탐색 불가는 정상 동작
```

- 트리거: `MutationObserver` + `ResizeObserver`, **300ms 디바운스** (React 리렌더 폭주 대응)
- 마커 기본 위치: 해석 결과 요소의 **좌상단**(`rect.left`, `rect.top`) + `markerOffset` (킥오프 §11 14차 개정 — 종전 우상단). rect fallback 좌표도 동일 규칙(`x·콘텐츠폭`, `y·콘텐츠높이`)
- 뷰어에서도 동일 로직 사용 (스냅샷 DOM은 정적이지만 srcdoc 로드 시 1회 resolve 필요)

---

## 5. 장면 캡처 (sdk/freeze)

- **`single-file-core`를 SDK에 번들**하여 클라이언트(사용자 브라우저)에서 실행. 서버 헤드리스 재현 금지 결정의 구현.
- 옵션:
  - 스크립트 제거 (결과에 `<script>` 0개 — **검증 로직으로 강제**, 위반 시 캡처 실패 처리)
  - CSS 인라인화
  - 이미지 data URI화 (캡처 후처리로 큰 래스터는 WebP 재인코딩·2048px 상한 — §11 9차)
  - **폰트 차단**(`blockFonts`) — 웹폰트 임베드 없이 시스템 폰트로 렌더 (킥오프 §11 11차). CJK 웹폰트 비대화 방지 + 폰트 처리 크래시 표면 감소. 파생: `removeUnusedFonts`·`removeAlternativeFonts` off
  - **비디오·오디오 콘텐츠 미임베드** — 비디오는 `blockVideos`(포스터+링크 대체), 오디오·비디오 포스터는 single-file 옵션으로 못 막으므로 캡처 직전 `neutralizeMedia`가 `src`/`srcset`/`poster`를 임시 제거(요소=레이아웃 영역은 유지). 킥오프 §11 11차
  - `<canvas>` → `toDataURL()` 이미지 치환
  - SDK 자신 제외: `data-mockspec-root` 마킹 요소 제외 옵션
- 결과 HTML은 `POST /api/projects/:id/assets`로 업로드 → 응답 asset 키를 `Scene.snapshotAsset`에 기록
- 2단 폴백: 1차(전체 최적화)가 single-file 내부 오류로 throw하면 CSS 최소화를 끈 안전 옵션으로 1회 재시도 (킥오프 §11 3차·4차). `blockFonts`·`blockVideos`·`blockAudios`는 1차·폴백 공통
- 실패 정책: detailed-spec §3.7 (배지 + 재시도, 스크린샷 fallback은 S2)

---

## 6. Spec API (REST)

베이스: 콘솔은 루트 도메인 `/api`, SDK는 목업 서브도메인 `/__mockspec/api/*` (서버가 동일 라우터로 연결). **same-origin이므로 CORS 불필요** (ID-03). 인증 없음 (사내망 전제 + 비추측성 nanoid).

[S2.5] 예외 — 경로 D(`type: "snippet"`) 프로젝트의 저장 계열(PUT·assets·export)은
**`Authorization: Bearer {토큰}` 필수**(불일치·부재 401): SDK가 서비스 도메인 밖 임의
오리진에서 돌기 때문에 same-origin 신뢰가 없다. 저장은 확장 background 경유라 **CORS는
여전히 불필요** (pathD 킥오프 §4).

| 메서드/경로 | 역할 | 비고 |
|---|---|---|
| `POST /projects` | multipart(zip, name) → 프로젝트 생성 | 응답: SpecProject + 목업 URL. [S2] JSON body(`{ name, originUrl }`)도 수용 — §7.2 검증 + 오리진 `GET /` 도달성 확인 후 생성. [T29] 세 등록 경로 모두 `ownerLabel`(선택) 수용 |
| `GET /projects` | 목록 (콘솔용) | [T29] 항목마다 산출물 이력 요약(`exportCount`·`lastExportAt`) 동봉 (§6.3) |
| `GET /projects/:id` | spec.json 반환 | SDK 초기 로드 |
| `PUT /projects/:id` | SpecProject **전체 교체** | 500ms 디바운스 저장의 대상. `version`·`id` 불일치 시 400 |
| `DELETE /projects/:id` | 프로젝트 삭제 | 확인은 콘솔 UI 책임 |
| `POST /projects/:id/assets` | 캡처 스냅샷 업로드 | 응답: `{ assetKey }`. 50MB 제한, 재캡처·장면 삭제 시 이전 asset 즉시 삭제 (ID-11) |
| `GET /projects/:id/assets/:key` | 스냅샷 반환 | |
| `POST /projects/:id/export` | 산출물 HTML 조립 (§8) | 응답: HTML 파일 다운로드. [S2] 장면별 `maskedSnapshotAsset` 우선 사용 (detailed-spec §3.12). [T29] 성공 시 이력 메타 기록 (§6.3) |
| `POST /projects/:id/token` | [S2.5] 경로 D 토큰 재발급·폐기 | 경로 D 프로젝트 한정. 재발급 시 구 토큰 즉시 무효 (pathD 킥오프 §6) |

에러 응답 표준 (ID-10): `{ "error": { "code": "...", "message": "..." } }` — 코드는 `INVALID_REQUEST`(400) / `NOT_FOUND`(404) / `TOO_LARGE`(413) / `INTERNAL`(500) 4개로 시작. [S2] 프록시(경로 B)가 `BAD_GATEWAY`(502) 추가 — 오리진 도달 실패·오리진 밖 리다이렉트.

### 6.1 저장 방식의 근거

- 문서 전체 교체(PUT whole document): S1은 단일 편집자 전제(POL-M08)이므로 병합 불필요. 부분 PATCH·병합 로직을 만들지 않는다.
- 저장소는 파일 기반 JSON. **사내 도구에 DB 운영을 먼저 얹지 말 것** — DB는 S2에서 필요해질 때.

### 6.2 오프라인 큐 (sdk/api.ts)

- PUT 실패 시 `localStorage["mockspec:pending:{projectId}"]`에 최신 SpecProject 적재 (큐라기보다 최신본 1개 — 전체 교체 방식이므로)
- 온라인 복귀(online 이벤트)·SDK 재마운트 시 재전송, 성공하면 큐 비움
- 복원 충돌 규칙 (ID-05): pending이 존재하면 **묻지 않고 로컬 우선 PUT** (마지막 쓰기 승리). 비교·병합 UI 없음. 다중 탭 편집은 명시적 비지원 (POL-M08 연장)
- 패널 상단 저장 상태 표시와 연동 (detailed-spec §3.8)

### 6.3 산출물 이력 (server/store/exportStore.ts — T29, FR-EXP-08)

- 모든 export 경로(콘솔·SDK·확장)가 `POST /projects/:id/export` 한 곳을 지나므로 이 라우트에서 기록한다
- 레코드: `ExportRecord { id: "exp_"+nanoid(10), createdAt, specUpdatedAt, bytes, masked }` —
  `specUpdatedAt`은 export 시점 spec의 `updatedAt`(어느 판본을 내보냈는지), `masked`는 마스킹본 사용 여부
- 저장 위치: `data/projects/{id}/exports.json` — **서버 소유 별도 메타 파일**. spec.json에 넣지
  않는 이유는 토큰(token.json)과 동일: spec.json은 클라이언트 PUT이 전체 교체하는 파일이라
  클라이언트가 모르는 서버 기록이 덮어써진다
- 기록은 best-effort — 이력 쓰기 실패가 export 자체를 실패시키지 않는다
- 산출물 HTML 파일은 보관하지 않는다 (§2.2 — htmlRef 미채택 이유)

---

## 7. 보안

### 7.1 S1 (업로드 경로)

| 항목 | 사양 |
|------|------|
| zip-slip | 엔트리 경로 정규화(`path.normalize`) 후 프로젝트 디렉토리 prefix 검증, 이탈 시 해당 zip 거부 |
| 업로드 크기 | 200MB 하드 리밋 (multer limits) |
| 접근 제어 | 사내망 전제 + 비추측성 프로젝트 ID. 편집 URL을 아는 사람만 접근 |
| 스냅샷 무해화 | `<script>` 0개 검증 (§5) — 뷰어 srcdoc 렌더 시 실행 위험 제거 |
| SDK 데이터 경계 | SDK가 서버로 보내는 것은 spec 데이터 + 명시적 캡처 스냅샷뿐. 텔레메트리로 DOM을 흘리지 않는다 — **코드 리뷰 기준으로 강제** |

### 7.2 S2 (프록시 경로를 여는 순간 필수 — 킥오프 s2 §4)

| 항목 | 사양 |
|------|------|
| SSRF allowlist | `MOCKSPEC_PROXY_ALLOWLIST` env — 콤마 구분 호스트 패턴(`*.` 서브도메인 와일드카드 지원). **비어 있거나 미설정이면 URL 등록 자체를 400 거부** (deny-by-default). 관리 UI 없음 — 운영자가 env 한 줄로 통제 |
| 검증 시점 | ① URL 등록 시 ② **매 프록시 요청 시** (allowlist 축소·DNS 변경 반영) |
| hard-deny IP | DNS resolve 결과가 루프백(127.0.0.0/8, ::1)·unspecified·링크로컬/클라우드 메타데이터(169.254.0.0/16, fe80::/10)·ULA(fc00::/7, fd00::/8 포함)면 **allowlist와 무관하게 차단**. 단 사설 대역(10/8, 172.16/12, 192.168/16)은 hard-deny하지 않음 — 사내 스테이징이 그 대역이며, allowlist 명시가 곧 허용 의사. IPv4-mapped IPv6는 언랩 후 판정 |
| DNS rebinding | 업스트림 연결은 `lookup: guardedLookup`으로 **검증된 resolve 결과 IP로 고정** (Host 헤더만 원 호스트) — 검증과 연결 사이의 재바인딩 차단. IP 리터럴 오리진은 lookup을 안 타므로 프록시 핸들러가 동기 직접 검증 |
| dev/test 스위치 | `MOCKSPEC_PROXY_ALLOW_LOOPBACK`(참이면 127/8·::1·unspecified만 완화, 메타데이터·ULA·링크로컬 차단은 유지). fixture·로컬 dev 서버가 127.0.0.1에 뜨므로 프록시 경로 검증에 필요. **운영 배포에서는 끈다** (루프백=서비스 자신) |
| 리다이렉트 | 서버가 따라가지 않음(`redirect: "manual"`, §3.3) — 매 hop이 클라이언트 왕복으로 신규 요청 검증을 거침 (원 결정 "hop별 재검증"의 구현) |
| 프로토콜 | `http:`·`https:`만. 포트는 URL에 명시된 것만 |
| 인증 쿠키 | `Set-Cookie`의 `Domain` 속성 제거(host-only로 프록시 서브도메인에 재바인딩), 프록시가 http일 땐 `Secure`도 제거. `Path` 유지. **여기까지만** — SSO 콜백 등으로 안 풀리는 인증은 프록시로 뚫지 않고 미지원 안내 (경로 D가 열리면 우회 안내로 전환) |
| 실데이터 반출 | 내보내기 전 마스킹 편집 (detailed-spec §3.12) — 프록시 목업은 스테이징 실데이터를 담을 수 있음 |

### 7.3 S2.5 (경로 D — 클라이언트 주입, pathD 킥오프 §4)

| 항목 | 사양 |
|------|------|
| SSRF | **표면 없음** — 서버가 목업을 fetch하지 않는다. §7.2의 allowlist·IP 고정은 경로 D에 불필요 |
| 저장 인증 (신규 표면) | 경로 D 프로젝트의 저장 계열(PUT·assets·export)은 프로젝트 토큰(`Authorization: Bearer`) 필수 — 임의 페이지에서 도는 SDK가 남의 프로젝트에 쓰지 못하게 하는 유일한 경계. 서버는 해시만 보관(평문 미저장), spec.json 밖 별도 메타 파일 |
| CORS | 저장이 확장 background(`host_permissions`) 경유라 **미구현** — 표면을 넓히지 않는다. 후속에 스니펫(옵션 S)을 도입하면 그때 토큰 게이트 CORS 추가 |
| 페이지 CSP | content script 주입이라 대상 페이지 `script-src`와 무관. sdk.js는 확장 번들에 포함(서비스에서 로드하지 않음) |
| 실데이터 반출 | S2 마스킹 그대로 적용 — 경로 D 스냅샷도 실데이터를 담을 수 있음. SDK 전송 범위는 S1·S2 그대로(NFR-04) |

---

## 8. 산출물 HTML 조립 사양 (server/routes/export.ts)

`POST export`가 조립하는 단일 .html 파일. `file://`로 열려야 한다.

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>{프로젝트명} 기획서</title>
  <style>/* viewer CSS 인라인 */</style></head>
<body>
  <script type="application/json" id="spec-data">{ SpecProject JSON }</script>
  <script type="text/plain" data-snapshot="{sceneId}">{ 캡처 HTML, base64 }</script>
  <!-- 장면 수만큼 반복 -->
  <div id="app"></div>
  <script>/* viewer JS 번들 인라인 */</script>
</body>
</html>
```

- 스냅샷은 base64로 인라인 → 뷰어가 디코드해 `<iframe sandbox="allow-same-origin" srcdoc>`에 주입. `allow-same-origin`으로 `contentDocument` 접근(마커 좌표 계산)은 허용하되 스크립트 실행은 차단 — `<script>` 0개 검증과 이중 방어 (ID-13). `file://`에서도 동작
- 뷰어 템플릿은 서비스가 관리하는 정적 자산 (viewer 패키지 빌드 산출물) → 템플릿 개선 시 기존 프로젝트도 재내보내기로 혜택
- 크기 가드: 조립 결과 50MB 초과 시 경고와 함께 진행
- 스냅샷 없는 장면: 플레이스홀더 + 경고

---

## 9. 테스트 전략

| 레벨 | 도구 | 대상 |
|------|------|------|
| Unit | vitest | 앵커 생성·재해석(§4 각 단계별), zip-slip 검증, zip 불필요 경로 제외 필터(§3.2), 번호 할당(중간 결번 유지·끝 번호 재사용), spec 직렬화 왕복 무손실, 스냅샷 `<script>` 0개 검증기 |
| API | vitest (supertest 등) | §6 전체 엔드포인트 — 프로젝트 생성→PUT→GET 왕복 시 데이터 무손실 |
| E2E | Playwright 1본 | S1 DoD 시나리오 그대로 자동화 (아래) |

### 9.1 E2E = S1 Definition of Done

fixtures 사양은 implementation-decisions ID-12 (의존성 0의 Todo SPA, 라우트 2개, 부착 대상 4개 이상).

```
1. 샘플 SPA 목업(Todo 앱, 레포 fixtures/ 포함) zip 업로드
2. 편집 화면에서 장면 2개 등록, 어노테이션 각 2개 부착·설명 입력
3. export → 산출물 HTML을 새 브라우저 컨텍스트에서 file://로 오픈
4. 검증:
   - 장면 2개 전환 가능
   - 마커 4개가 올바른 요소 위에 표시
   - 설명 텍스트 일치
   - 네트워크 요청 0건 (완전 오프라인)
```

통과 후 실사용 1회(팀 내 실제 목업으로 기획서 1부)에서 "목업 팀 도움 없이 가능했는가" 판정을 킥오프 스펙 §11에 기록 → S2 계획의 입력.

### 9.2 WBS (의존 순서 — 킥오프 스펙 §10)

| # | 작업 | 완료 기준 (AC) |
|---|------|---------------|
| T1 | 모노레포 셋업 + shared 타입 | §1.3 구조로 빌드 통과, §2 타입이 3패키지에서 import됨 |
| T2 | 서버: 업로드·해제·정적 서빙·SDK 주입 | 샘플 zip 업로드 → 서브도메인에서 목업 열림, sdk.js 태그 존재, zip-slip 테스트 통과 |
| T3 | Spec API + 파일 저장 | §6 전체 엔드포인트 vitest 통과 (왕복 무손실) |
| T4 | SDK: FAB·패널·모드 전환 | 편집/미리보기 토글, Shadow DOM 격리, 미리보기에서 목업 정상 조작 |
| T5 | SDK: 어노테이션·앵커·마커 | 부착 시퀀스 동작, 라우트 복귀 시 마커 복원, 텍스트 변경 후 재탐색 성공 1케이스 |
| T6 | SDK: 장면 등록 + 캡처 | 스냅샷 업로드 확인, 단독 오픈 시 레이아웃·구조가 원본과 동일(폰트 시스템 대체·미디어 영역만, §11 11차)(수동) + `<script>` 0개(자동) |
| T7 | SDK: 저장·오프라인 큐 | 서버 중단 상태 편집 → 재기동 후 자동 반영 |
| T8 | 뷰어 + export 조립 | §8 사양 HTML이 file://로 열림, 마커·패널·상호 하이라이트 동작 |
| T9 | 콘솔 페이지 | 업로드→편집 열기→export가 콘솔만으로 가능 |
| T10 | E2E (Playwright) | §9.1 시나리오 자동화 통과 |

S2 (킥오프 s2 §8 — T1~T10 완료 후):

| # | 작업 | 완료 기준 (AC) |
|---|------|---------------|
| T11 | shared 타입 확장 | mockupSource union·maskingRules·maskedSnapshotAsset 추가, 기존 S1 spec.json 왕복 무손실 |
| T12 | SSRF 가드 모듈 (§7.2) | allowlist 매칭·hard-deny IP·IP 고정 연결 유닛 테스트. 미설정 시 등록 거부. **T13은 이 모듈 없이 노출 금지** |
| T13 | 프록시 코어 + SDK 주입 (§3.3) | fixture 오리진 등록 → 프록시 경유로 열리고 sdk.js 태그 존재, CSP/XFO 제거, 비HTML 스트림 통과, 오리진 밖 리다이렉트 502 |
| T14 | 쿠키 재바인딩 (§7.2) | Set-Cookie Domain·Secure 처리 vitest, 쿠키 세션 fixture로 로그인 유지 확인 |
| T15 | 콘솔 온보딩 폼 (detailed-spec §2.3) | URL 등록→편집 열기까지 콘솔만으로 가능, 비허용 오리진 400 사유 표시 |
| T16 | 마스킹 (detailed-spec §3.12) | 규칙 추가→[전체 장면에 적용]→export 산출물에서 원문 0회·치환문 존재 |
| T17 | E2E: S2 DoD (§9.3) | 프록시 시나리오 추가 통과, S1 시나리오 회귀 없음 |
| T18 | CI 파이프라인 | GitHub Actions 워크플로우 1본(typecheck→build→test→e2e). 전제: 원격 저장소 개설(사용자 결정) |

[S2.5] 경로 D WBS (pathD 킥오프 §7 — T18에 이어 번호):

| # | 작업 | AC 요약 |
|---|------|---------|
| T19 | 데이터 모델 + 토큰 발급/검증 | `snippet` 변형 왕복 무손실, 토큰 발급·해시검증·폐기 유닛 |
| T20 | 저장 경로 토큰 인증 | 경로 D 프로젝트 저장이 토큰 없으면 401, 타 프로젝트 토큰 거부 |
| T21 | 콘솔 온보딩 3번째 선택지 | 경로 D 프로젝트 생성 → 토큰·설치 안내 노출 |
| T22 | 확장 스캐폴드 + content script SDK 주입 | unpacked 로드 → 페이지에 FAB·패널 동작 |
| T23 | 확장 팝업(바인딩) + background 저장 | 임의 사이트에서 편집·캡처·저장 성공 |
| T24 | E2E: 로그인 뒤 화면 시나리오 | pathD 킥오프 §7 DoD |
| T25 | docs/ 최종 동기화 + 실사용 판정 기록 | 판정 기록으로 S2.5 종료 |

전이·흐름도 WBS (2026-07-12 착수 확정 — FR-EDT-10·FR-EXP-06, T25에 이어 번호):

| # | 작업 | AC 요약 |
|---|------|---------|
| T26 | shared: `Annotation.transition` 승격 | 왕복 무손실, transition 없는 기존 spec.json 하위 호환 |
| T27 | SDK: 전이 지정 UI | 어노테이션 폼에 장면 드롭다운(다른 장면만)+조건 텍스트, 저장 왕복. 대상 장면 삭제 시 transition 함께 제거 |
| T28 | 뷰어·산출물: 전이 링크 + 흐름도(자체 SVG) | 전이 링크 클릭 시 장면 전환, 흐름도 노드/간선 라벨 렌더(전이 없으면 섹션 생략), E2E — file://에서 흐름도·링크 동작·네트워크 0건 |

작성자 라벨·산출물 이력 WBS (2026-07-14 착수 확정 — FR-CON-03·FR-EXP-08, T28에 이어 번호):

| # | 작업 | AC 요약 |
|---|------|---------|
| T29 | `ownerLabel` 승격 + 산출물 이력(메타 전용, §6.3) | 세 등록 경로 ownerLabel 수용·왕복 무손실(라벨 없는 기존 spec.json 하위 호환), export 시 이력 기록·목록 요약 동봉, 콘솔 카드·삭제 confirm·산출물 헤더에 작성자 표시 |

### 9.3 E2E = S2 Definition of Done (킥오프 s2 §8)

```
1. fixture 목업(Todo 앱)을 로컬 HTTP 서버로 기동 (URL 오리진 역할)
2. 콘솔에서 URL 등록 (allowlist에 fixture 호스트만 든 전용 env) → 편집 화면이 프록시 경유로 열림
3. 장면 2개 등록·어노테이션 부착·설명 입력 (S1 편집 플로우가 프록시 위에서 동작)
4. 마스킹 규칙 1건 추가 → 전체 장면 적용
5. export → 새 브라우저 컨텍스트에서 file:// 오픈
6. 검증: 장면 전환·마커 위치(≤2px)·설명 일치, 마스킹 원문 문자열 0회, 네트워크 요청 0건
7. 보안 회귀: 비허용 오리진·메타데이터 IP 등록이 400 거부 (API 레벨)
```

통과 후 실사용 1회(실제 스테이징 URL 목업으로 기획서 1부)에서 "zip을 만들지 않고
가능했는가" 판정을 킥오프 s2 §9에 기록 → S2 종료.

---

## 10. 확정 결정 요약 (구현 중 이탈 금지 목록)

| 결정 | 내용 |
|------|------|
| 신규 레포 | 기존 Draftify 코드 이식 금지. 계승은 "규범으로 관리한다"는 원칙과 실패의 교훈뿐 — ID 체계는 [output-standard.md](./output-standard.md)에서 신규 설계 |
| LLM | 기본 미사용. 유일한 LLM 기능(S3 초안 제안)은 옵트인 — 기본 OFF, OFF 시 호출 경로 자체 비활성 |
| 캡처 위치 | 클라이언트 브라우저에서만. 서버 헤드리스 재현 금지 |
| 장면 생성 | 사람이 선언. 자동 생성 금지 (라우트 감지는 제안만) |
| 앵커 1순위 | selector+text+attrs 다중 시그니처 (`data-spec-id`는 서비스 모델에서 제외) |
| 산출물 | 단독 HTML 단일 형식. PPT 없음. file:// 동작 + 네트워크 0건 |
| 저장 | 파일 기반 JSON + 문서 전체 교체 PUT. DB·병합 로직은 S2 이후 필요 시 |
| 인증 | 없음 (사내망 + 비추측성 ID). SSO는 조건부 |
| 프레임워크 | SDK=Preact, 뷰어=vanilla, 콘솔=정적 HTML 1장, 서버=Express 5 |
| 실행 모델 | S1은 로컬 실행. 오리진 하드코딩 금지 (상대 경로 + Host 파싱 + env) — 배포는 설정 변경으로 흡수 |
| 브라우저 | 편집 환경 Chrome/Edge 최신 한정. 뷰어는 표준 API만 사용 |
| [S2] 프록시 | undici 직접 구현 (프록시 라이브러리 미도입). HTML만 버퍼링·가공, 리다이렉트 manual, WebSocket 미지원 절단 |
| [S2] SSRF | env allowlist deny-by-default + hard-deny IP(사설 대역 예외) + resolve IP 고정 연결. 미설정 시 등록 거부 |
| [S2] 마스킹 | 평문 find→replace 규칙만 (정규식·클릭 편집기 기각). 마스킹본은 콘솔 브라우저에서 생성 — 서버 HTML 파싱 금지. 원본 보존 |
| 결정 변경 절차 | 임의 이탈 금지 — 킥오프 스펙(해당 단계)을 먼저 수정하고 결정 변경 이력에 이유 기록 후 진행 |
