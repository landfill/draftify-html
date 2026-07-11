import {
  PROJECT_DATA_ATTR,
  TRANSPORT_DATA_ATTR,
  BRIDGE_REQUEST_TYPE,
  BRIDGE_RESPONSE_TYPE,
} from "@mockspec/shared";
import { readBinding } from "./binding.js";

/**
 * [S2.5] content script (pathD 킥오프 §2·§4.2).
 *
 * ① 바인딩된 오리진에만 SDK 주입 — `<script src={확장 내 sdk.js} data-project data-transport>`.
 *    확장 자원 로드라 대상 페이지 CSP(script-src)와 무관하고, sdk.js는 기존 번들 그대로
 *    document.currentScript로 부트한다. 경로 A·B로 이미 주입된 페이지는 건너뛴다.
 * ② API 브리지 — 페이지(SDK)의 postMessage 요청을 background로 릴레이한다.
 *    페이지 컨텍스트는 서버로 직접 fetch할 수 없다(CORS·페이지 CSP connect-src) —
 *    background가 host_permissions + Bearer 토큰으로 대신 보낸다.
 */

interface BridgeRequestMessage {
  type: typeof BRIDGE_REQUEST_TYPE;
  id: number;
  req: unknown;
}

void (async () => {
  const binding = await readBinding(location.origin);
  if (!binding) return;

  // ② 브리지 릴레이 — 주입 전에 등록해 SDK 첫 요청(fetchProject)부터 받는다
  window.addEventListener("message", (ev: MessageEvent) => {
    if (ev.source !== window) return;
    const data = ev.data as BridgeRequestMessage | null;
    if (!data || data.type !== BRIDGE_REQUEST_TYPE) return;

    chrome.runtime
      .sendMessage({ kind: "mockspec:api", req: data.req })
      .then((response: unknown) => {
        window.postMessage({ type: BRIDGE_RESPONSE_TYPE, id: data.id, response }, "*");
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        window.postMessage({ type: BRIDGE_RESPONSE_TYPE, id: data.id, error: message }, "*");
      });
  });

  // ① SDK 주입
  if (document.querySelector(`script[${PROJECT_DATA_ATTR}]`)) return;
  const tag = document.createElement("script");
  tag.src = chrome.runtime.getURL("sdk.js");
  tag.setAttribute(PROJECT_DATA_ATTR, binding.projectId);
  tag.setAttribute(TRANSPORT_DATA_ATTR, "extension");
  (document.body ?? document.documentElement).appendChild(tag);
})();
