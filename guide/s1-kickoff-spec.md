# S1 킥오프 스펙 — Mockup-as-Spec 서비스 구현 사양

> 작성일: 2026-07-06
> 선행 문서 (필독 순서):
> 1. [mockup-as-spec-guide.md](./mockup-as-spec-guide.md) — 코어 개념 (장면, 앵커, 동결)
> 2. [mockup-as-spec-service-architecture.md](./mockup-as-spec-service-architecture.md) — 서비스 구성 (온보딩, 컴포넌트, S1~S3)
> 3. 이 문서 — S1 구현을 위한 **확정 사양**
>
> **이 문서의 지위**: 아래 "결정" 항목들은 재검토 대상이 아니라 확정 사항이다.
> 구현 중 결정을 뒤집어야 할 근거가 발견되면, 임의로 이탈하지 말고 이 문서를 먼저 수정하고
> 그 이유를 §11 결정 변경 이력에 기록한 뒤 진행한다.

---

## 0. S1 한 줄 정의 (선행 문서 §6 재확인)

> **zip을 업로드하면 목업이 서비스 안에서 열리고, 어노테이션을 달아,
> 단독 실행 HTML 기획서로 내보낼 수 있다.**

검증 질문: "남이 만든 목업을 목업 팀 도움 없이 기획서로 만들 수 있는가"

S1 범위 밖 (구현 금지 — S2/S3 몫): URL 프록시(경로 B), 로컬 스니펫(경로 D), 레포 빌드(경로 C),
장면 전이·흐름도, LLM 초안, 실시간 협업, 마스킹 편집.

로드맵 전체에서 제외 (S2/S3에서도 구현하지 않음 — 서비스 문서 §6 non-goal):
PPT 등 HTML 외 산출물 형식, 크롤러 기반 장면 시딩, 기존 Draftify 코드 이식.
SSO는 서비스 문서 §3.5의 조건 충족 시에만 검토.

---

## 1. 결정: 프로젝트 위치와 워킹네임

- **신규 레포로 시작한다.** 이 레포(Draftify-omo2)의 코드는 S1에 가져오지 않는다
  (서비스 아키텍처 문서 §7의 결정 준수).
- 워킹네임: **`mockspec`** (레포명 겸용, 추후 변경 가능 — 코드 내 하드코딩 금지,
  패키지명과 표시 문자열은 상수 한 곳에서 관리)
- 새 레포 생성 시 이 레포의 `docs/guide/` 3종을 새 레포 `docs/`로 복사해 간다.

---

## 2. 결정: 기술 스택

| 영역 | 결정 | 이유 |
|------|------|------|
| 언어 | TypeScript (strict) 전 패키지 공통 | 타입 정의(§5)가 패키지 간 계약이므로 |
| 런타임 | Node.js 20+ | |
| 모노레포 | npm workspaces (turbo/nx 도입 금지) | S1 규모에 도구 오버헤드 불필요 |
| SDK UI | **Preact** + Shadow DOM | 3KB급으로 단일 번들 유지, 패널 UI에 JSX 생산성. React는 번들 크기로 배제 |
| SDK 번들 | Vite lib mode → 단일 IIFE `sdk.js` | 주입 한 파일 원칙 (서비스 문서 §3.2) |
| 서버 | **Express 5** | 팀 경험 재사용 (기존 Draftify 스택). Fastify 등으로 갈아타지 말 것 |
| 저장 | **파일 기반 JSON** (프로젝트당 1파일) + 디스크 asset store | S1은 단일 편집자 전제라 동시성 불필요. DB는 S2에서 필요 시 |
| zip 처리 | `multer`(업로드) + `unzipper`(해제) | |
| DOM 동결 | **`single-file-core`** (npm) | §7 상세. 직접 구현 금지 — CSS 인라인/폰트/이미지 처리 재발명은 S1 최대 리스크 |
| 뷰어 | 프레임워크 없는 vanilla TS → 인라인 단일 번들 | 산출물 HTML에 통째로 인라인되므로 의존성 최소화 |
| 테스트 | vitest (unit) + Playwright (E2E 1본) | E2E는 §10 DoD 시나리오 그대로 자동화 |

---

## 3. 결정: 레포 구조

```
mockspec/
├─ docs/                        # 가이드 3종 + 이 문서 복사본
├─ packages/
│  ├─ shared/                   # spec 타입 정의 (§5) — 유일한 계약 소스
│  │  └─ src/types.ts
│  ├─ sdk/                      # Spec Editor SDK (Preact, Shadow DOM)
│  │  ├─ src/
│  │  │  ├─ main.ts             # 진입점: mount, 편집/미리보기 모드 전환
│  │  │  ├─ overlay/            # 마커 렌더, 요소 하이라이트
│  │  │  ├─ panel/              # 우측 패널 (장면 목록, 어노테이션 편집)
│  │  │  ├─ anchor/             # 앵커 생성·재해석 (§6)
│  │  │  ├─ freeze/             # single-file-core 래핑 (§7)
│  │  │  └─ api.ts              # Spec API 클라이언트 + localStorage 큐
│  │  └─ vite.config.ts         # → dist/sdk.js (IIFE 1파일)
│  ├─ server/                   # Express: 호스팅+주입, Spec API, Export
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ routes/projects.ts  # 업로드, CRUD (§8)
│  │     ├─ routes/serve.ts     # 목업 서빙 + SDK 주입 (§4)
│  │     ├─ routes/export.ts    # 산출물 조립 (§9)
│  │     └─ store/              # JSON 파일 저장, asset store
│  └─ viewer/                   # 산출물 HTML의 뷰어 (빌드 → server가 템플릿으로 사용)
│     └─ src/main.ts
└─ data/                        # (gitignore) projects/{id}/spec.json, assets/
```

빌드 의존: `shared` → (`sdk`, `server`, `viewer`). `viewer`의 빌드 산출물은 `server`가
export 시 템플릿으로 읽는다.

---

## 4. 결정: 목업 서빙과 SDK 주입

- **프로젝트별 서브도메인**: `{projectId}.localhost:4000` (모던 브라우저는 `*.localhost`를
  DNS 설정 없이 127.0.0.1로 해석한다 — 로컬/사내 S1에 충분). 콘솔(관리 UI)은
  `localhost:4000` 루트에서 서빙. Express에서 Host 헤더로 분기.
- zip 해제 후 정적 서빙. `text/html` 응답에만 `</body>` 직전
  `<script src="/__mockspec/sdk.js" data-project="{projectId}" defer></script>` 삽입.
  (SDK는 `data-project`로 자기 프로젝트를 식별 — docs/implementation-decisions.md ID-03)
- `/__mockspec/*` 경로는 SDK 자산·API 프록시용 예약 경로 (목업 파일과 충돌 회피).
- SPA fallback: 확장자 없는 404 → `index.html`.
- 업로드 제약(콘솔 UI에 명시): SPA는 상대 base(`vite build --base ./`) 또는 루트 base 빌드만
  지원. base가 하위 경로로 박힌 빌드는 서브도메인 방식이라 대부분 무관하지만,
  안내 문구는 넣는다.
- zip 크기 제한 200MB, 해제 시 zip-slip 방지(경로 정규화 후 프로젝트 디렉토리 밖 기록 거부) 필수.
- **최상위 폴더 자동 언랩**: 해제(제외 필터 적용) 후 모든 엔트리가 하나의 최상위 디렉토리
  체인을 공유하면 그 공통 접두 디렉토리를 벗겨 루트로 승격한다 (`dist/index.html` →
  `index.html`). 사람들은 보통 `dist` 폴더를 통째로 압축하므로, 언랩 없이는 대부분의
  업로드가 "루트 index.html 없음"으로 거부된다. `..`·절대 경로 세그먼트는 접두로 취급하지
  않으며(zip-slip 검증은 언랩과 무관하게 유지), 언랩 결과는 업로드 응답에 실어 콘솔이 표시.

---

## 5. 결정: 데이터 모델 (packages/shared/src/types.ts)

이것이 SDK↔서버↔뷰어 간 유일한 계약이다. 필드 추가는 자유, 필드 의미 변경은 §11 기록 필수.

```typescript
export interface SpecProject {
  version: 1;
  id: string;                    // "prj_" + nanoid(10)
  name: string;
  createdAt: string;             // ISO 8601
  updatedAt: string;
  mockupSource: { type: "upload"; originalFilename: string; uploadedAt: string };
  scenes: Scene[];
  annotations: Annotation[];
}

export interface Scene {
  id: string;                    // "scn_" + nanoid(10)
  title: string;                 // 사용자 입력, 기본값 document.title
  route: string;                 // 등록 시점 location.pathname+search+hash
  stateNote?: string;            // "모달 열림 상태" 등
  order: number;                 // 패널·뷰어 정렬 기준
  snapshotAsset?: string;        // asset store 키. 동결 성공 시에만 존재
  frozenAt?: string;
}

export interface Annotation {
  id: string;                    // "ann_" + nanoid(10)
  sceneId: string;
  number: number;                // 장면 내 1부터. 재부여 규칙: §6.3
  anchor: Anchor;
  title: string;
  description: string;           // 마크다운 허용 (뷰어에서 렌더)
  policyRefs?: string[];         // "POL-014" 등. S1은 저장·표시만
  markerOffset?: { dx: number; dy: number }; // 마커 표시 오프셋(px) — 기본 위치(요소 우상단)에서 드래그로 옮긴 상대값. §11 4차 개정
}

export interface Anchor {
  selector: string;              // 구조적 CSS 셀렉터 (자동 생성)
  text?: string;                 // 요소 textContent 앞 40자 (검증용 시그니처)
  attrs?: Record<string, string>; // aria-label, role, name 등 존재하는 것만
  rect: { x: number; y: number; w: number; h: number }; // 문서(document) 기준 비율(0~1), 최후 fallback — §11 2차 개정
}
```

- `data-spec-id`(선행 가이드의 1순위 앵커)는 **S1에서 제외** — 서비스 모델에서는 목업
  소스를 수정하지 않으므로 소스 반영이 불가능하다. selector+text+attrs 다중 시그니처가
  S1의 1순위다. (선행 가이드 §4와의 의도적 차이 — 서비스 문서 §1의 제1 기준 우선)
- 저장 파일: `data/projects/{projectId}/spec.json` = `SpecProject` 직렬화 그대로.
  이 파일을 그대로 내려주는 것이 export/import(백업)이다.

---

## 6. 결정: SDK 인터랙션 사양

### 6.1 모드와 진입

- SDK는 mount 시 우측 하단 플로팅 버튼(FAB)만 표시. 클릭 시 **편집 모드** 진입:
  우측에 360px 패널이 `position: fixed`로 도킹되고 `document.documentElement`에
  `margin-right: 360px` 적용 (목업 레이아웃 축소). 전체 UI는 Shadow DOM 안.
- 모드는 2개뿐: **미리보기**(목업 원래대로 동작, 마커는 표시) / **편집**(아래 6.2).
  토글은 패널 상단 스위치. 단축키 `Alt+Shift+E`.

### 6.2 어노테이션 부착 시퀀스

```
편집 모드에서:
1. 마우스오버 → 대상 요소 하이라이트 (outline, Shadow DOM 오버레이로 그림)
2. 클릭 → 목업의 원래 클릭은 capture 단계에서 차단(preventDefault+stopPropagation)
3. 대상 요소에 현재 장면 어노테이션이 이미 있으면 → 그 어노테이션 선택 (생성 아님).
   같은 요소에 하나 더 달려면 Shift+클릭 (§11 4차 개정)
4. 없으면(또는 Shift+클릭) 현재 장면에 Annotation 생성: 다음 번호 자동 부여, 앵커 자동 생성(§5)
5. 요소 위에 숫자 마커 렌더, 패널의 해당 항목이 열리며 title 입력란에 포커스
6. 입력 → 500ms 디바운스로 저장 (§6.4)
```

- **빈 어노테이션 = 미작성 핀**: title·description이 모두 빈 어노테이션은 삭제하지 않고
  유지한다 — "요소를 먼저 찍어두고 내용은 한 번에 작성"하는 워크플로우 지원 (§11 5차 개정,
  4차 개정의 자동 삭제를 철회). 대신 미작성 상태를 마커·목록에 구분 스타일로 표시하고,
  패널에 [빈 어노테이션 정리] 버튼(확인 1회)으로 일괄 삭제를 제공한다. 번호 규칙은 §6.3 유지.
- **마커 드래그**: 편집 모드에서 마커를 드래그해 위치를 옮길 수 있다. 저장값은 절대 좌표가
  아니라 **기본 위치(요소 우상단) 기준 상대 오프셋**(`markerOffset`, px) — 앵커 재해석이
  요소를 다시 찾을 때마다 오프셋을 더해 렌더하므로 마커는 여전히 요소를 따라간다.
  뷰어(산출물)도 동일 오프셋을 적용한다. 클릭(선택)과 드래그는 이동 임계값(수 px)으로 구분.

- 요소를 조작(클릭·입력)해서 목업 상태를 바꿔야 할 때는 **미리보기 모드로 전환**해서 한다.
  "편집 모드에서 Ctrl+클릭하면 통과" 같은 예외는 만들지 않는다 (혼동 원인).
- 마커 기본 위치는 앵커 재해석 결과 요소의 우상단 (+`markerOffset`). 재해석은 `MutationObserver` +
  `ResizeObserver`, 300ms 디바운스. selector 실패 시 text/attrs로 재탐색 후 selector 자동
  갱신, 그것도 실패하면 rect 위치에 "위치 불확실" 스타일(점선)로 렌더.

### 6.3 장면 시퀀스

- 패널의 **[+ 현재 화면을 장면으로]** 버튼:
  1. Scene 생성 (title=document.title, route=현재 경로)
  2. 즉시 동결 시도 (§7) → 성공 시 snapshotAsset 저장, 실패 시 §7.3
  3. 패널이 해당 장면으로 전환. 이후 부착하는 어노테이션은 이 장면 소속
- 장면 삭제 시 소속 어노테이션도 삭제 (확인 다이얼로그 1회). 어노테이션 삭제 시
  **번호는 재부여하지 않는다** — 빈 번호 허용 (이미 공유된 산출물과의 번호 불일치 방지).
- SPA 라우트 변경 감지(history 후킹)는 패널에 "새 장면으로 등록할까요?" 배너만 띄운다.
  자동 생성 금지 (선행 가이드 §5).

### 6.4 저장

- 모든 변경은 즉시 Spec API로 PUT (500ms 디바운스, 문서 전체 교체 방식 — S1은 단일
  편집자이므로 병합 불필요).
- **패널 하단 [내보내기] 버튼**: 콘솔과 동일한 export API·경고 규칙(스냅샷 없는 장면 확인,
  50MB 경고)으로 산출물 HTML을 편집 화면에서 바로 다운로드 (§11 6차 개정 — 콘솔로
  빠져나가야 받을 수 있던 동선 단축).
- 실패 시 localStorage 큐(`mockspec:pending:{projectId}`)에 적재, 온라인 복귀·재방문 시 재전송.
  패널 상단에 저장 상태 표시 (저장됨 / 저장 중 / 오프라인-로컬보관).

---

## 7. 결정: 장면 동결 구현

- **`single-file-core`를 SDK에 번들**하여 클라이언트에서 실행한다 (서비스 문서 §3.4:
  서버 헤드리스 재현 금지 결정의 구현).
- 옵션: 스크립트 제거, CSS 인라인, 이미지·폰트 data URI화, `<canvas>`는 `toDataURL()`로
  이미지 치환. 산출물 스냅샷에 `<script>`가 하나도 없어야 한다 (뷰어에서 srcdoc로 열 때
  실행 금지 — 검증 로직으로 강제).
- 결과 HTML은 `POST /api/projects/:id/assets`로 업로드, 응답의 asset 키를 Scene에 기록.
- 편집 패널 자신(Shadow DOM 호스트)은 동결 대상에서 제외 (SDK 루트 요소에
  `data-mockspec-root` 마킹 후 제외 옵션 사용).

### 7.3 동결 실패 시 (S1 정책)

- 에러 토스트 + 해당 장면에 "동결 실패 — 재시도" 배지. 어노테이션 작성은 계속 가능
  (동결은 export에만 필요).
- html2canvas 등 스크린샷 fallback은 **S2로 연기** (선행 가이드 §10-1과 다른 S1 절단 —
  fallback 품질 문제로 S1이 늘어지는 것 방지). 단, export 시 동결 없는 장면은 산출물에서
  "스냅샷 없음" 플레이스홀더로 표시하고 경고를 낸다.

---

## 8. 결정: Spec API (REST)

베이스: 콘솔은 루트 도메인의 `/api`, SDK는 목업 서브도메인의 `/__mockspec/api/*`
(서버가 동일 API로 연결 — same-origin이므로 **CORS 불필요**, §11 2차 개정).
S1 인증 없음(사내망 전제), 단 프로젝트 id 자체가 비추측성(nanoid)이라는 점만 확보.

| 메서드/경로 | 역할 | 비고 |
|---|---|---|
| `POST /projects` | multipart(zip, name) → 프로젝트 생성 | 응답: SpecProject + 목업 URL |
| `GET /projects` | 목록 (콘솔용) | |
| `GET /projects/:id` | spec.json 반환 | SDK 초기 로드 |
| `PUT /projects/:id` | SpecProject 전체 교체 | 저장 방식 §6.4. `version`·`id` 불일치 시 400 |
| `DELETE /projects/:id` | 프로젝트 삭제 | 확인은 콘솔 UI 책임 |
| `POST /projects/:id/assets` | 동결 스냅샷 업로드 | 응답: `{ assetKey }` |
| `GET /projects/:id/assets/:key` | 스냅샷 반환 | |
| `POST /projects/:id/export` | 산출물 HTML 조립 (§9) | 응답: HTML 파일 다운로드 |

콘솔 UI(루트 도메인): 프로젝트 목록·업로드 폼·"편집 열기" 링크·export 버튼만 있는
단일 페이지면 충분. S1에서는 서버가 서빙하는 정적 HTML 1장으로 구현 (React 금지 —
콘솔에 프레임워크 붙이는 건 S2에서 필요해질 때).

---

## 9. 결정: 산출물 HTML 사양

`POST export`가 조립하는 **단일 .html 파일**, `file://`로 열려야 한다.

구조:

```html
<!doctype html>
<html>
<head><meta charset="utf-8"><title>{프로젝트명} 기획서</title>
  <style>/* viewer CSS 인라인 */</style></head>
<body>
  <script type="application/json" id="spec-data">{ SpecProject JSON }</script>
  <script type="text/plain" data-snapshot="{sceneId}">{ 동결 HTML, base64 }</script>
  <!-- 장면 수만큼 반복 -->
  <div id="app"></div>
  <script>/* viewer JS 번들 인라인 */</script>
</body>
</html>
```

뷰어 동작:
- 좌측 얇은 사이드바: 장면 목록 (order 순). 선택 시 중앙에 해당 장면 표시
- 중앙: `<iframe>`에 스냅샷을 **srcdoc**으로 주입 (base64 디코드 → srcdoc는 부모와
  same-origin이므로 file://에서도 contentDocument 접근 가능). iframe 위에 오버레이
  레이어를 겹치고, 앵커 재해석(§6.2와 동일 로직 — `shared`가 아니라 anchor 모듈을
  sdk/viewer가 공유하도록 배치)으로 숫자 마커를 그림. 실패 시 rect fallback
- 우측: 어노테이션 목록 (번호, title, description 마크다운 렌더, policyRefs 뱃지).
  마커 클릭 ↔ 목록 항목 상호 하이라이트·스크롤
- 상단 바: 프로젝트명, 생성 일시, 장면 수/어노테이션 수
- 스냅샷 없는 장면: 중앙에 플레이스홀더 + "편집 화면에서 동결 후 재내보내기" 안내

크기 가드: 조립 결과 50MB 초과 시 경고와 함께 진행 (메일 첨부 한계 안내).

---

## 10. S1 작업 분해(WBS)와 완료 기준

의존 순서대로. 각 항목의 완료 기준(AC)이 충족되어야 다음으로.

| # | 작업 | 완료 기준 (AC) |
|---|------|---------------|
| T1 | 모노레포 셋업 + shared 타입 | §3 구조로 빌드 통과, §5 타입이 3패키지에서 import됨 |
| T2 | 서버: 업로드·해제·정적 서빙·SDK 주입 | 샘플 Vite 빌드 zip 업로드 → `{id}.localhost:4000`에서 목업이 열리고 HTML 소스에 sdk.js 태그 존재. zip-slip 테스트 통과 |
| T3 | Spec API + 파일 저장 | §8 전체 엔드포인트 vitest 통과 (프로젝트 생성→PUT→GET 왕복 시 데이터 무손실) |
| T4 | SDK: FAB·패널·모드 전환 | 목업 위에서 편집/미리보기 토글, 목업 CSS와 간섭 없음(Shadow DOM), 미리보기에서 목업 정상 조작 |
| T5 | SDK: 어노테이션 부착·앵커·마커 | §6.2 시퀀스 동작. 목업 라우트 이동 후 복귀 시 마커 복원. 요소 텍스트 변경 후에도 재탐색 성공 1케이스 |
| T6 | SDK: 장면 등록 + 동결 | 장면 추가 시 스냅샷 asset 업로드 확인. 스냅샷 단독으로 브라우저에서 열어 원본과 시각적 동일(수동 확인) + `<script>` 0개(자동 검증) |
| T7 | SDK: 저장·오프라인 큐 | 서버 중단 상태에서 편집 → 재기동 후 자동 반영 |
| T8 | 뷰어 + export 조립 | §9 사양의 HTML이 file://로 열림. 마커·패널·상호 하이라이트 동작 |
| T9 | 콘솔 페이지 | 업로드→편집 열기→export 다운로드가 콘솔만으로 가능 |
| T10 | E2E (Playwright) | 아래 DoD 시나리오 자동화 통과 |

### S1 Definition of Done (전체)

Playwright로 자동화할 단일 시나리오:

1. 샘플 SPA 목업(Todo 앱, 레포 내 `fixtures/`에 포함) zip 업로드
2. 편집 화면에서 장면 2개 등록, 어노테이션 각 2개 부착·설명 입력
3. export → 산출물 HTML을 새 브라우저 컨텍스트에서 file://로 오픈
4. 검증: 장면 2개 전환 가능, 마커 4개가 올바른 요소 위에 표시, 설명 텍스트 일치,
   네트워크 요청 0건 (완전 오프라인)

이것이 통과하고, **실사용 1회**(팀 내 실제 목업 하나로 기획서 1부 완성)에서 편집 UX에
대한 판정("목업 팀 도움 없이 가능했는가")을 기록하면 S1 종료. 판정 결과는 이 문서
§11에 남기고 S2 계획의 입력으로 쓴다.

---

## 11. 결정 변경 이력

| 일자 | 변경 | 이유 |
|------|------|------|
| 2026-07-06 | 초판 확정 | — |
| 2026-07-06 | 범위 정리: PPT export·크롤러 시딩을 로드맵 전체에서 제거, SSO를 조건부 도입으로 강등, 기존 코드 재활용 철회 | 산출물은 HTML 단일 형식(탈 PPT가 프로젝트 동기), 크롤러는 헤드리스 재현 금지 원칙과 모순, 소비(전달)에 인증 불필요, 기존 비효율은 실행 방식의 문제라 이식할 코드 없음 |
| 2026-07-06 | 2차 개정: ① `Anchor.rect`를 뷰포트 기준 → **문서 기준 비율**로 재정의 ② SDK의 API 호출을 CORS 방식 → **same-origin `/__mockspec/api` 프록시**로 변경, 주입 태그에 `data-project` 속성 추가 ③ 필드 추가: `Scene.code`(SCR-### 표시 코드)·`sceneCodeSeq`·`annoNumberSeq` | ① 뷰포트 기준은 부착 시점 스크롤 위치에 따라 값이 달라져 fallback으로 성립 불가 ② CORS 설정 제거 + 오리진 하드코딩 방지 ③ 번호 재부여 금지 규칙은 max+1로는 지켜지지 않음(삭제 후 재사용). 상세: docs/implementation-decisions.md, docs/output-standard.md |
| 2026-07-10 | 3차 개정: zip 해제 시 **최상위 폴더 자동 언랩** 추가 (§4). 모든 엔트리가 공통 최상위 디렉토리 체인을 공유하면 벗겨서 루트로 승격 | 사용자는 보통 빌드 결과 폴더(`dist` 등)를 통째로 압축한다. 언랩 없이는 zip 루트가 `dist/`가 되어 "루트 index.html 없음"으로 거부 — 안내 문구만으로 막기 어려운 흔한 실수. 언랩은 단순·범용적이고, 루트에 index.html이 이미 있으면 공통 접두가 성립하지 않아 기존 동작 불변 |
| 2026-07-10 | 4차 개정 (실사용 1회 피드백): ① `Annotation.markerOffset` 추가 — 편집 모드 마커 드래그로 위치 조정, 요소 우상단 기준 상대 오프셋(px)으로 저장해 앵커 추적과 공존, 뷰어도 동일 적용 ② 부착 시퀀스 변경 — 이미 어노테이션이 있는 요소 클릭은 선택, 같은 요소 추가는 Shift+클릭 ③ 빈(title·description 모두 공백) 어노테이션은 선택 해제 시 자동 삭제 | 실사용 테스트에서 (a) 마커가 항상 우상단 고정이라 내용을 가리거나 겹침 (b) 클릭=생성 방식이 중복 생성·오클릭 잔재 혼란 유발. 클릭=생성의 속도는 유지하면서 중복(②)과 잔재(③)만 정면 해결 — 핀 도구 분리·확인 팝오버는 매 부착에 비용을 물려 기각. 절대 좌표 저장은 리렌더 추적과 모순이라 상대 오프셋 채택 |
| 2026-07-10 | 5차 개정 (실사용 2회 피드백): 4차 개정 ③(빈 어노테이션 선택 해제 시 자동 삭제) **철회**. 빈 어노테이션은 "미작성 핀"으로 유지하고, ① 마커·목록에 미작성 구분 스타일 ② 패널 [빈 어노테이션 정리] 일괄 삭제 버튼(확인 1회)으로 대체 | 자동 삭제가 "요소를 차례로 찍어두고 내용을 한 번에 작성"하는 실재 워크플로우와 정면 충돌(연속 클릭 시 이전 핀이 계속 소멸, 번호만 증가). 오클릭 잔재의 주범(중복 생성)은 4차 개정 ②가 이미 해결 — 잔재 방지는 자동이 아니라 가시화(미작성 표시)+사용자 주도 정리(버튼)로 회수 |
| 2026-07-10 | 6차 개정 (실사용 3회 피드백): 편집 패널 하단에 [내보내기] 버튼 추가 — 콘솔과 동일한 export API(`POST /projects/:id/export`, 서브도메인은 same-origin 프록시 경유)·경고 규칙으로 산출물을 편집 화면에서 바로 다운로드 | 내보내기가 콘솔에만 있어 편집 후 목록 화면으로 빠져나가야 다운로드 가능 — 편집→확인의 핵심 루프를 끊는 동선. export 엔드포인트는 이미 same-origin 프록시로 서브도메인에 열려 있어 서버 변경 없음 |
| | (구현 중 이탈 발생 시 여기에 기록) | |

### S1 실사용 판정 (2026-07-10, §10 DoD의 마지막 조건)

**판정: 가능 — 목업 팀 도움 없이 실제 목업으로 기획서 1부(업로드→장면·어노테이션→export→file:// 열람)를 완성했다.** 단, 최초 시도에서 편집 UX 결함·불편 5건이 발견되어 반영 후 재검증으로 확정했다 (4~6차 개정 + fix 2건):

| # | 발견 (실사용) | 반영 |
|---|---------------|------|
| 1 | 마커가 요소 우상단 고정 — 내용 가림·겹침 조정 불가 | 마커 드래그(`markerOffset` 상대 오프셋, 4차 개정) |
| 2 | 클릭=생성 방식의 중복 생성 혼란 | 마커 있는 요소 클릭=선택, Shift+클릭=추가 (4차 개정) |
| 3 | 요소를 먼저 찍고 내용을 나중에 쓰는 워크플로우 불가(빈 어노테이션 자동 삭제와 충돌) | 자동 삭제 철회 → 미작성 핀 유지 + 구분 표시 + [빈 어노테이션 정리] (5차 개정) |
| 4 | 어노테이션이 늘면 패널 아래쪽 스크롤 불가 | `.panel__body` 스크롤 영역 (fix) |
| 5 | 내보내기가 콘솔에만 있어 편집→확인 루프가 끊김 | 패널 하단 [내보내기] 버튼 (6차 개정) |

**S2 계획 입력:**
- 온보딩: S1은 경로 A(zip)만 — 실사용에서 "index.html이 없는(SSR·dev 서버 전용) 목업은 어떻게 쓰나"는 질문이 바로 나옴. 경로 B(URL 프록시)·D(로컬 스니펫)의 우선순위 판단 필요
- zip 경로 자체의 마찰은 최상위 폴더 언랩(3차 개정)으로 해소 확인
- 편집 UX의 신규 부채 없음 — 위 5건 반영 후 재검증 통과
