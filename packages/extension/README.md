# mockspec 브라우저 확장 (경로 D)

로그인해 둔 화면 위에 편집기(SDK)를 주입하고, 저장은 background service worker가 서비스로
릴레이한다. 서버는 목업을 fetch하지 않는다(SSRF 표면 없음 — technical-spec §7.3).

## 빌드·로드

```bash
npm run build -w @mockspec/extension     # dist/ 생성
```

Chrome → `chrome://extensions` → 개발자 모드 → **압축해제된 확장 프로그램을 로드** → `dist/`.

공개판 사용자는 사이트의 `/download/mockspec-extension.zip`을 내려받아 압축을 풀고,
그 안의 `mockspec-extension/` 폴더를 같은 방식으로 로드한다. 이 ZIP은 공개판 빌드가
`dist/`에서 자동 생성하며 Git에는 커밋하지 않는다.

## 배포 버전

`manifest.json`의 `version`이 정본이다. 공개된 확장 내용이 바뀌면 배포 전에 다음 규칙으로
올린다.

- patch: 버그·보안 수정
- minor: 기존 바인딩과 호환되는 기능 또는 권한 변경
- major: 바인딩·저장 계약이 기존 설치본과 호환되지 않는 변경

다운로드 URL은 버전과 무관하게 고정하고, 콘솔·가이드가 manifest 버전을 함께 표시한다.

## 저장 대상 서버 = `host_permissions` (중요)

팝업에서 입력하는 **서버 URL**은 background가 `fetch`할 대상이고, 실제로 허용되는 호스트는
`manifest.json`의 `host_permissions`가 정한다. 즉 **manifest에 있는 호스트로만 프로젝트 토큰이
나간다.**

```json
"host_permissions": [
  "https://draftify-html.vercel.app/*",
  "http://localhost/*",
  "http://127.0.0.1/*"
]
```

- **로컬은 포트를 적지 않는다.** MV3 match pattern은 포트를 구분하지 않으므로 `http://localhost/*`가
  모든 포트를 덮는다. 사내판(4000)·공개판 dev(3000)·E2E(4123)를 한 줄로 커버하기 위한 것이다.
- **팝업의 서버 주소 기본값은 `http://localhost:4000`(사내판)이다.** 입력란의 초기값일 뿐이며 접속
  대상은 사용자가 정한다(ID-01). 공개판을 쓸 때는 배포 호스트를, 공개판 로컬 개발에는 `:3000`을
  직접 입력한다.
- **원격 호스트에 와일드카드를 넣지 않는다.** `https://*.vercel.app/*` 같은 패턴은 *모든* vercel.app
  앱으로 토큰을 보낼 수 있는 표면이 된다(W8 결정 — 킥오프 스펙 §7.5).
- **프로덕션 배포 시**: 확정된 호스트 **하나**를 정확히 추가한다. 공개판 첫 배포(2026-07-29)로
  `https://draftify-html.vercel.app/*`을 등록했다. 도메인이 바뀌면 이 줄을 교체한다(추가가 아니라
  교체 — 쓰지 않는 호스트를 남겨 두지 않는다).

  추가 후 확장을 다시 빌드·로드하고, 팝업의 서버 URL을 그 호스트로 바꾼다. 호스트가 manifest에
  없으면 저장 요청이 조용히 실패하는 대신 fetch 자체가 차단된다.

## 바인딩

팝업에서 현재 탭 오리진에 `projectId` + 토큰 + 서버 URL을 묶는다(`chrome.storage`). 바인딩이 없는
오리진에는 SDK를 주입하지 않는다.
