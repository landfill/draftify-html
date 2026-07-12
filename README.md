# Mockup-as-Spec (mockspec)

> 각자가 이미 만든 목업을 등록하면, 그 위에 숫자 어노테이션을 달아
> **단독 실행 가능한 기획서 HTML**을 만들어 주는 사내 서비스.
> 산출물은 `file://`로 열리고 네트워크 요청이 0건이다.

이 문서는 **서버 실행과 기본 흐름(ZIP 업로드 경로)의 빠른 시작**이다.
목업 연결 방식은 세 가지가 있고, 방식별 상세 사용법·동작 원리·제약·적합한 경우는
**[docs/user-guide.md](./docs/user-guide.md) (사용 가이드)**에 있다:

| 경로 | 언제 | 상세 |
|------|------|------|
| A. ZIP 업로드 | 빌드 결과물(zip)을 만들 수 있다 — **기본 권장** | 이 문서 §2~4 + [가이드 §1](./docs/user-guide.md#1-경로-a--zip-업로드) |
| B. URL 프록시 | 로그인 없이 URL로 열리는 목업 | [가이드 §2](./docs/user-guide.md#2-경로-b--url-프록시) |
| D. 내 화면에서 편집 (확장) | 로그인해야 보이는 화면·사내망·로컬 | [가이드 §3](./docs/user-guide.md#3-경로-d--내-화면에서-편집-확장--상세) |

제품 정의·스펙·작업 규약은 [docs/README.md](./docs/README.md)(문서 인덱스)와
[AGENTS.md](./AGENTS.md)(에이전트 작업 규약)를 본다.

## 요구 환경

- Node.js 20+
- 편집 환경 브라우저: Chrome/Edge 최신 (뷰어 산출물은 표준 API만 사용)

## 1. 서버 실행

```bash
npm install                            # 최초 1회
npm run build                          # 최초 1회 또는 코드 변경 후
node packages/server/dist/index.js     # 기본 포트 4000
```

실행되면 두 URL이 출력된다:

```
[mockspec] 콘솔: http://localhost:4000  |  목업: http://{projectId}.localhost:4000
```

- **콘솔** (`localhost:4000` 루트): 프로젝트 업로드·목록·내보내기·삭제. 사용자가 직접 여는 곳은 여기뿐이다
- **목업** (`{projectId}.localhost:4000` 서브도메인): 업로드하면 서버가 **자동으로** 이 주소에서
  목업을 편집 SDK가 주입된 채 서빙한다. 별도 설정은 필요 없다 — Chrome/Edge는 `*.localhost`를
  DNS·hosts 설정 없이 로컬로 해석한다. 프로젝트마다 호스트를 나누는 이유는 목업 간
  localStorage·쿠키 격리와 절대 경로(`/assets/…`) 빌드의 무수정 동작 (technical-spec §3.1)

옵션 (오리진 하드코딩 금지 원칙 — 설정은 env로만):

| env | 기본값 | 용도 |
|-----|--------|------|
| `PORT` | `4000` | 리스닝 포트 |
| `MOCKSPEC_DATA_DIR` | 저장소 안 `data/` | 프로젝트 spec·목업·스냅샷 저장 위치 (gitignore 대상) |

서버가 죽어 있는 동안의 편집은 브라우저 localStorage 큐에 보관됐다가 재기동 후 자동 반영된다.
초기화하고 싶으면 서버 중지 후 `data/`를 삭제한다.

## 2. 목업 zip 준비

업로드 대상은 **소스 코드가 아니라 빌드 산출물**이다. 목업 프로젝트에서:

```bash
npm run build        # dist/ 또는 build/ 생성
zip -r mockup.zip dist
```

Finder에서 `dist` 폴더 우클릭 → "압축"도 동일하게 동작한다.
zip 루트가 `dist/` 한 겹으로 감싸져 있으면 서버가 자동으로 벗겨 해제한다(최상위 폴더 언랩).

| 조건 | 내용 |
|------|------|
| 필수 | 빌드 산출물 루트에 `index.html` (SSR 전용 앱은 정적 export 필요 — Next.js는 `output: 'export'`) |
| 크기 | zip 파일 기준 200MB 이하. `node_modules/`·`.git/`·`*.map` 등은 해제 시 자동 제외되지만 zip 크기 제한은 압축 파일 기준이므로 빌드 결과물만 압축 권장 |
| base | 루트 또는 상대 base(`vite build --base ./`) 권장. 하위 경로 base는 서브도메인 서빙이라 대부분 무관하나 보장하지 않음 |

연습용 샘플이 필요하면 `npm run fixtures:zip`으로 `fixtures/todo-app.zip`(의존성 0 Todo SPA)을 만들 수 있다.

## 3. 업로드 → 편집

1. **http://localhost:4000** 접속 → 새 프로젝트 폼에 이름 + zip 업로드
2. 업로드 완료 안내의 **편집 열기 →** 링크 클릭 (목업이 새 탭에서 SDK 주입된 채 열림)

편집 화면(우하단 FAB → 우측 360px 패널):

| 동작 | 방법 |
|------|------|
| 화면 등록 | 목업을 원하는 상태로 조작(라우팅·모달·필터 등) → **[+ 현재 화면 등록]** → `✓ 동결됨` 배지 확인. 실패 시 배지에서 재시도 |
| 어노테이션 부착 | **편집 모드** 토글(Alt+Shift+E) → 설명할 요소 클릭 → 마커 생성, title/설명 입력 |
| 목업 조작 복귀 | **미리보기 모드**로 전환 (편집 모드에선 목업 클릭이 차단됨) |
| 저장 | 자동 (패널 상단 `저장됨 ✓` 표시 확인 — 별도 버튼 없음) |

등록하는 "화면"은 URL 단위가 아니라 **사람이 의미를 부여한 상태**(모달 열림, 탭 선택 등)다.
설명할 상태마다 "화면 등록 → 어노테이션 부착"을 반복한다. 어노테이션은 항상 현재 선택된 화면에 소속된다.

## 4. 내보내기 → 산출물 확인

1. 콘솔 목록에서 **내보내기** 클릭 → 단일 HTML 다운로드 (스냅샷 없는 화면이 있으면 확인 후 진행)
2. 다운로드한 HTML을 더블클릭(`file://`)으로 연다 — 서버·네트워크 없이 동작해야 정상:
   - 화면 전환이 되고 각 화면이 편집 때 모습과 동일
   - 마커가 요소 위치에 붙고 마커↔목록 상호 하이라이트
   - DevTools Network 탭: 문서 자체 1건 외 외부 요청 0건
3. 이 파일 하나를 슬랙·메일로 전달하면 받은 사람은 그냥 열기만 하면 된다

## 테스트

```bash
npm test             # vitest (unit + API)
npm run test:e2e     # Playwright — 빌드·fixtures zip·서버 기동까지 자체 수행
                     # 최초 1회: npx playwright install chromium
```

## 저장소 구조

```
packages/shared    타입 계약 (유일 소스)
packages/server    Express 5 — 업로드·서빙·SDK 주입·Spec API·export 조립
packages/sdk       편집기 (Preact + Shadow DOM, 단일 IIFE sdk.js)
packages/viewer    산출물 HTML에 인라인되는 vanilla 뷰어
fixtures/todo-app  E2E·연습용 샘플 SPA
docs/  guide/      스펙·결정 문서 (docs/README.md에서 시작)
```
