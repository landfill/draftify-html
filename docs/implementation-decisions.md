# 구현 결정 보충 — 미정의 지점 확정 (S1)

> 작성일: 2026-07-06
> 문서 지위: 기존 문서(PRD·상세 기획·기술 스펙)에서 미정의였던 지점의 **확정 결정**.
> 판단 기준: **구현이 단순하고 범용적일 것.** 모든 결정은 더 정교한 대안이 있음을 알고도
> 단순한 쪽을 고른 것이며, "버린 대안" 열에 그 이유를 남긴다.
> 킥오프 스펙의 기존 결정을 변경하는 항목(ID-03, ID-04)은 guide/s1-kickoff-spec.md §11에 기록했다.

---

## A. 환경·계약

### ID-01. 배포: S1은 로컬 실행 — 단, 오리진 하드코딩 금지

- **결정**: S1은 각자 로컬에서 `npm start`로 띄우는 실행 모델. 사내 서버/외부 호스팅 배포는 지금 결정하지 않는다.
- **지금 지킬 것 (코드 규율 1개)**: 코드 어디에도 `localhost:4000` 같은 오리진을 하드코딩하지 않는다. 클라이언트(SDK·콘솔·뷰어)는 상대 경로만 사용, 서버는 Host 헤더에서 프로젝트 서브도메인을 파싱하고 포트는 env(`PORT`, 기본 4000)로 받는다.
- **효과**: 이후 사내 배포는 와일드카드 DNS + env 설정으로 끝난다. 코드 변경 없음.
- **버린 대안**: 지금 배포 도메인 전략 확정 — 결정을 미뤄도 비용이 없으므로 불필요.

### ID-02. 지원 브라우저

- **결정**: **편집 환경은 Chrome/Edge 최신 한정** (확정). 그 외 브라우저에서 SDK 동작은 보장하지 않으며 대응하지 않는다.
- **뷰어(산출물)**: 소비자가 어디서 열지 통제할 수 없으므로 특정 브라우저 전용 API를 쓰지 않는다(표준 DOM + srcdoc만). 공식 검증은 Chrome/Edge, 그 외 모던 브라우저는 best effort.

### ID-03. SDK 프로젝트 식별과 API 호출 경로 — CORS 제거

- **결정**: 주입 태그를 `<script src="/__mockspec/sdk.js" data-project="{projectId}" defer>`로 확장. SDK는 `document.currentScript.dataset.project`로 자기 프로젝트를 안다. API 호출은 목업 서브도메인에서 **same-origin `/__mockspec/api/*`** 로 보내고, 서버가 내부 Spec API로 연결한다.
- **효과**: CORS 설정 자체가 사라진다. 호스트 파싱 로직도 SDK에 불필요.
- **버린 대안**: 킥오프 스펙 §8의 `localhost:4000/api` + `*.localhost` CORS 허용 — 동작하지만 설정 한 겹이 더 있고 오리진 하드코딩(ID-01 위반)을 유발한다. §11에 변경 기록.

### ID-04. `Anchor.rect` 좌표 기준 — 문서(document) 기준 비율로 재정의

- **결정**: rect는 **문서 기준 비율** — `(getBoundingClientRect + scrollX/Y) ÷ (scrollWidth/scrollHeight)`. 렌더 시 역계산해 문서 좌표에 마커를 놓는다 (콘텐츠와 함께 스크롤됨).
- **이유**: 킥오프 스펙의 "뷰포트 대비 비율"은 부착 시점 스크롤 위치에 따라 같은 요소가 다른 값을 갖는다 — fallback으로서 성립하지 않음. 스키마는 동일, 의미만 변경. §11에 기록.

### ID-05. 오프라인 큐 복원 충돌 — 로컬 우선

- **결정**: SDK 마운트 시 `mockspec:pending:{projectId}`가 있으면 **묻지 않고 로컬본을 PUT** (마지막 쓰기 승리). 성공 시 큐 삭제.
- **이유**: 단일 편집자 전제(POL-M08)에서 pending이 존재한다는 것 자체가 "가장 최근 편집이 로컬에 있다"는 뜻. 비교·병합 UI는 만들지 않는다.
- **명시적 비지원**: 같은 프로젝트를 탭 2개로 편집하는 것. 문제가 생기면 사용자 과실 — POL-M08의 연장으로 콘솔 도움말에 한 줄 안내만.

---

## B. 알고리즘·API 세부

### ID-06. selector 생성 알고리즘

```
generate(el):
1. el에 id가 있고 문서 내 유일 → "#id" 완료
2. 아니면 el부터 위로 올라가며, id가 유일한 가장 가까운 조상(없으면 body)을 기준점으로:
   기준점부터 el까지 각 단계를 "tag:nth-of-type(n)"으로 체인
   예: "#root > div:nth-of-type(2) > button:nth-of-type(1)"
3. 생성 결과를 querySelectorAll로 검증 — 매치 1개가 아니면 body부터 전체 경로로 재생성
```

- **클래스는 사용하지 않는다.** CSS-in-JS 해시 클래스(`css-1x2y3z`)와 유틸리티 클래스(tailwind)를 구분하는 안정성 판별이 필요해지는데, 그 복잡도 대비 nth-of-type 체인 + text/attrs 보정(ID-07)으로 충분하다.
- **버린 대안**: 클래스 안정성 휴리스틱, 속성 조합 최적화 — 범용성이 깨지는 지점.

### ID-07. 재탐색(2단계) 매칭 규칙

```
refind(anchor):
1. 후보 수집: selector의 마지막 세그먼트와 같은 tagName인 모든 요소 중
   normalize(textContent 앞 40자) === normalize(anchor.text) 인 것
   (normalize = 공백 연속 → 단일 공백, trim)
2. anchor.attrs가 있으면: 저장된 속성이 모두 일치하는 것만 남김
3. 후보 1개 → 확정. 여러 개 → rect 중심점과 최근접인 것. 0개 → 실패 (rect fallback)
```

- text가 없는 요소(아이콘 버튼 등)는 attrs만으로 1~2단계 수행. 둘 다 없으면 재탐색 불가 → rect fallback (정상 동작이며 버그 아님).

### ID-08. 부착 대상 요소 선정

- **결정**: 클릭 지점 요소에서 가장 가까운 **인터랙티브 조상**(`a, button, input, select, textarea, label, [role=button], [role=link], [role=tab], [onclick], [tabindex]`)을 잡는다. 인터랙티브 조상이 없으면 클릭된 요소 그대로.
- 부모로 확장하는 별도 UI(휠·키 조작)는 **만들지 않는다** — 컨테이너에 달고 싶으면 컨테이너의 여백을 클릭하면 된다.
- 같은 요소에 **중복 어노테이션 허용** — 금지 검사(앵커 동등성 비교)가 오히려 복잡하고, "한 버튼에 정상/에러 두 설명"은 정당한 사용이다. 마커는 겹치면 살짝 어긋나게 렌더.

### ID-09. "현재 장면"의 상태 규칙

- **결정**: **패널에서 선택된 장면이 곧 현재 장면.** 라우트와 자동 연동하지 않는다.
  - 마커는 현재 장면 소속 어노테이션만 렌더한다 (route 매칭으로 다른 장면 마커를 보여주는 로직을 만들지 않음)
  - 미리보기 모드에서 라우트를 이동해도 현재 장면은 유지된다. 라우트 변경 배너(detailed-spec §3.6)만 뜬다
  - 장면 등록 시 그 장면이 자동으로 현재 장면이 된다 (기존 사양 그대로)
- **이유**: "이 라우트에 어느 장면이 대응하나"는 결국 상태 추론이다 — 자동 추론 금지 원칙(POL-M03)의 연장선에서, 현재 장면도 사람이 명시적으로 고른다.

### ID-10. API 에러 응답 표준

```json
{ "error": { "code": "NOT_FOUND", "message": "project prj_abc123 not found" } }
```

| HTTP | code | 상황 |
|------|------|------|
| 400 | `INVALID_REQUEST` | 스키마 위반, version/id 불일치, index.html 없음 |
| 404 | `NOT_FOUND` | 프로젝트/asset 없음 |
| 413 | `TOO_LARGE` | zip 200MB / asset 50MB 초과 |
| 500 | `INTERNAL` | 그 외 — 상세는 서버 로그에만 |

코드 4개로 시작한다. 세분화는 실제 필요가 생길 때.

### ID-11. asset 수명 관리

- 스냅샷 업로드 크기 제한 **50MB** (산출물 크기 가드와 정합 — 장면 하나가 이미 50MB면 산출물은 성립 불가)
- 재동결 성공 시 이전 스냅샷 asset **즉시 삭제**, 장면 삭제 시 소속 asset 즉시 삭제
- 별도 GC(고아 asset 스캔)는 만들지 않는다 — 위 두 규칙이 지켜지면 고아가 생기지 않고, 버그로 생겨도 디스크 용량 문제일 뿐

---

## C. 품질·운영

### ID-12. E2E fixtures 사양

- `fixtures/todo-app/`: Vite + vanilla TS SPA. **외부 런타임 의존성 0** (프레임워크 없음)
- 라우트 2개: `/` (할 일 목록 — 입력창, 추가 버튼, 항목별 완료/삭제 버튼), `/stats` (통계 — 필터 버튼 2개)
- history 라우팅 사용 (SPA fallback 검증), 어노테이션 부착 대상 요소 4개 이상, 요소 텍스트가 상태에 따라 바뀌는 케이스 1개 (T5 재탐색 AC용)
- 레포에 소스와 빌드 zip 생성 스크립트를 포함 (`npm run fixtures:zip`)

### ID-13. 뷰어 iframe sandbox

- `<iframe sandbox="allow-same-origin" srcdoc="...">` — 스크립트 실행은 차단하되 부모의 `contentDocument` 접근(마커 좌표 계산)은 허용.
- 동결 시 `<script>` 0개 검증(POL-M06)과 **이중 방어**: 검증을 뚫은 인라인 이벤트 핸들러 등도 sandbox가 막는다.

### ID-14. 백업·로그

- **백업 = `data/` 디렉토리 복사.** 그게 전부가 되도록 모든 상태(spec.json, assets, 업로드 원본)를 `data/` 아래에만 둔다. 별도 백업 기능은 만들지 않는다.
- 로그: stdout에 요청 라인 + 에러 스택. 로그 파일·로테이션 없음 (로컬 실행 전제, ID-01).

### ID-15. spec.json 복원(import)

- 콘솔에 import UI를 **만들지 않는다.** 복원 절차는 `PUT /api/projects/:id` 에 spec.json을 그대로 보내는 것 — README에 curl 한 줄로 문서화만 한다. 실제 수요가 확인되면 콘솔에 노출.

---

## 결정 요약표

| ID | 결정 | 한 줄 |
|----|------|-------|
| ID-01 | 배포 | 로컬 실행. 오리진 하드코딩 금지만 지금 지킨다 |
| ID-02 | 브라우저 | 편집은 Chrome/Edge 최신 한정 (확정) |
| ID-03 | SDK 식별/API | data-project 속성 + same-origin `/__mockspec/api` — CORS 제거 |
| ID-04 | rect 기준 | 문서 기준 비율로 재정의 |
| ID-05 | 오프라인 복원 | 로컬 우선, 다중 탭 비지원 |
| ID-06 | selector 생성 | id 기준점 + nth-of-type 체인, 클래스 미사용 |
| ID-07 | 재탐색 | tag+text 완전 일치 → attrs 필터 → rect 최근접 |
| ID-08 | 부착 대상 | 인터랙티브 조상 우선, 확장 UI 없음, 중복 허용 |
| ID-09 | 현재 장면 | 패널 선택이 진실, 라우트 자동 연동 없음 |
| ID-10 | API 에러 | `{error:{code,message}}`, 코드 4개 |
| ID-11 | asset | 50MB 제한, 교체·삭제 시 즉시 정리, GC 없음 |
| ID-12 | fixtures | 의존성 0의 Todo SPA, 라우트 2개 |
| ID-13 | iframe | `sandbox="allow-same-origin"` 이중 방어 |
| ID-14 | 백업·로그 | data/ 복사가 백업, stdout 로그 |
| ID-15 | import | UI 없음, PUT 문서화만 |
