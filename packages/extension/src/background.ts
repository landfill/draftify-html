/**
 * [S2.5] background service worker.
 * T22 시점에는 설치 로그뿐 — T23에서 저장 릴레이(content → background → 서버,
 * `host_permissions` 기반 fetch + Bearer 토큰)가 여기에 들어온다 (pathD 킥오프 §4.2).
 * 리스너가 하나는 있어야 서비스 워커가 등록·기동된다 (Playwright의 확장 ID 탐지에도 필요).
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[mockspec] 확장 설치됨 — 콘솔에서 발급한 프로젝트 ID·토큰을 팝업에 연결하세요.");
});
