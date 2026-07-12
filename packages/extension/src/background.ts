import { readBinding } from "./binding.js";

/**
 * [S2.5] background service worker — API 릴레이 (pathD 킥오프 §4.2).
 *
 * content script가 넘긴 SDK 요청을 바인딩의 서버로 fetch한다:
 * - `host_permissions` 기반이라 CORS 대상이 아니다 (서버는 CORS 미구현 유지)
 * - 저장 계열 토큰(T20 게이트)은 여기서만 붙는다 — 페이지에는 토큰이 내려가지 않는다
 * - 바인딩·경로 가드: 발신 오리진(sender)의 바인딩만 쓰고, 그 프로젝트의 API 경로만 허용 —
 *   페이지의 임의 스크립트가 브리지로 다른 프로젝트·경로에 접근하는 것을 막는다
 * - `X-Mockspec-Page-Origin`: 서버가 snippet 프로젝트의 lastSeenOrigin 표시용으로 스탬프
 */

interface RelayRequest {
  path?: unknown;
  method?: unknown;
  body?: unknown;
  bodyType?: unknown;
  download?: unknown;
}

interface RelayResponse {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

const ALLOWED_METHODS = new Set(["GET", "PUT", "POST", "DELETE"]);
const PASSED_HEADERS = ["content-disposition", "x-mockspec-warning"] as const;

function errorResponse(message: string): RelayResponse {
  return {
    ok: false,
    status: 0,
    headers: {},
    bodyText: JSON.stringify({ error: { code: "BRIDGE", message } }),
  };
}

async function relay(senderOrigin: string, raw: RelayRequest): Promise<RelayResponse> {
  const binding = await readBinding(senderOrigin);
  if (!binding) return errorResponse("이 사이트에 연결된 프로젝트가 없습니다.");

  const path = typeof raw.path === "string" ? raw.path : "";
  const method = typeof raw.method === "string" ? raw.method.toUpperCase() : "";
  if (!ALLOWED_METHODS.has(method)) return errorResponse("허용되지 않은 메서드입니다.");
  // 자기 프로젝트의 API만 — 정확 일치 또는 하위 경로
  const prefix = `/projects/${binding.projectId}`;
  if (path !== prefix && !path.startsWith(`${prefix}/`)) {
    return errorResponse("바인딩된 프로젝트의 API만 호출할 수 있습니다.");
  }

  // 다운로드 요청(export): 본문을 메시지로 되돌리지 않고 chrome.downloads로 직접 저장 —
  // 확장 메시지는 64MiB 하드 리밋이 있어 큰 산출물이 브리지를 건널 수 없다 (실사용 13차).
  // 파일명은 서버의 Content-Disposition을 브라우저가 그대로 쓴다.
  if (raw.download === true) {
    if (path !== `${prefix}/export` || method !== "POST") {
      return errorResponse("다운로드는 내보내기 경로만 허용됩니다.");
    }
    const downloadId = await chrome.downloads.download({
      url: `${binding.serverUrl}/api${path}`,
      method: "POST",
      headers: [
        { name: "Authorization", value: `Bearer ${binding.token}` },
        { name: "X-Mockspec-Page-Origin", value: senderOrigin },
      ],
    });
    return {
      ok: true,
      status: 200,
      headers: { "x-mockspec-native-download": "1" },
      bodyText: JSON.stringify({ downloadId }),
    };
  }

  const headers: Record<string, string> = {
    authorization: `Bearer ${binding.token}`,
    "x-mockspec-page-origin": senderOrigin,
  };
  let body: BodyInit | undefined;
  if (raw.bodyType === "json" && typeof raw.body === "string") {
    headers["content-type"] = "application/json";
    body = raw.body;
  } else if (raw.bodyType === "snapshot" && typeof raw.body === "string") {
    const form = new FormData();
    form.append("snapshot", new Blob([raw.body], { type: "text/html" }), "snapshot.html");
    body = form;
  }

  const res = await fetch(`${binding.serverUrl}/api${path}`, { method, headers, body });
  const passed: Record<string, string> = {};
  for (const name of PASSED_HEADERS) {
    const value = res.headers.get(name);
    if (value !== null) passed[name] = value;
  }
  return { ok: res.ok, status: res.status, headers: passed, bodyText: await res.text() };
}

chrome.runtime.onMessage.addListener(
  (msg: { kind?: string; req?: RelayRequest }, sender, sendResponse: (r: RelayResponse) => void) => {
    if (msg?.kind !== "mockspec:api") return false;
    const senderOrigin = sender.origin ?? (sender.url ? new URL(sender.url).origin : null);
    if (!senderOrigin) {
      sendResponse(errorResponse("발신 오리진을 확인할 수 없습니다."));
      return false;
    }
    relay(senderOrigin, msg.req ?? {})
      .then(sendResponse)
      .catch((err: unknown) => {
        sendResponse(errorResponse(err instanceof Error ? err.message : String(err)));
      });
    return true; // 비동기 sendResponse
  }
);

chrome.runtime.onInstalled.addListener(() => {
  console.log("[mockspec] 확장 설치됨 — 콘솔에서 발급한 프로젝트 ID·토큰을 팝업에 연결하세요.");
});
