import {
  RESERVED_PATH_PREFIX,
  BRIDGE_REQUEST_TYPE,
  BRIDGE_RESPONSE_TYPE,
} from "@mockspec/shared";

/**
 * [S2.5] API transport 추상화 (pathD 킥오프 §4.2).
 *
 * - 기본(fetchTransport): 경로 A·B — same-origin `/__mockspec/api` fetch. S1/S2 동작 그대로.
 * - 확장(createBridgeTransport): 경로 D — SDK는 임의 오리진의 페이지에서 돌므로 직접 fetch가
 *   불가(CORS·페이지 CSP connect-src). window.postMessage로 content script에 넘기면
 *   background service worker가 host_permissions 기반 fetch + Bearer 토큰으로 서버에 전달한다.
 *
 * API 표면이 작아(GET/PUT json·스냅샷 업로드·export) 요청은 문자열 본문으로 정규화한다 —
 * chrome.runtime 메시지는 JSON 직렬화만 지원하므로 Blob/FormData는 브리지를 건널 수 없다.
 * 스냅샷(HTML)·export 산출물(HTML)은 본질이 텍스트라 손실이 없다.
 */

export interface TransportRequest {
  /** `/projects/...` — api base 이하 경로 */
  path: string;
  method: "GET" | "PUT" | "POST" | "DELETE";
  /** 문자열 본문. bodyType이 결정: json=그대로, snapshot=서버에서 multipart 재조립 */
  body?: string;
  bodyType?: "json" | "snapshot";
  /**
   * 응답이 파일(다운로드)인 요청 표시 — export 전용. 브리지(경로 D)는 이 요청을 본문 릴레이
   * 대신 chrome.downloads로 넘긴다: 확장 메시지는 64MiB 하드 리밋이 있어 큰 산출물이
   * 브리지를 건널 수 없다 (실사용 13차). fetch transport는 무시(기존 blob 흐름).
   */
  download?: boolean;
}

export interface TransportResponse {
  ok: boolean;
  status: number;
  /** 소문자 헤더명 → 값. 브리지는 SDK가 쓰는 것만 전달 (content-disposition, x-mockspec-warning) */
  headers: Record<string, string>;
  bodyText: string;
}

export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

const API_BASE = `${RESERVED_PATH_PREFIX}/api`;

/** SDK가 응답에서 실제로 읽는 헤더만 통과시킨다 — 브리지 계약과 동일 폭. */
const PASSED_HEADERS = ["content-disposition", "x-mockspec-warning"] as const;

function pickHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of PASSED_HEADERS) {
    const value = headers.get(name);
    if (value !== null) out[name] = value;
  }
  return out;
}

/** 경로 A·B 기본 transport — same-origin 상대 경로 fetch (ID-01/03). */
export const fetchTransport: Transport = async ({ path, method, body, bodyType }) => {
  const init: RequestInit = { method };
  if (bodyType === "json" && body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = body;
  } else if (bodyType === "snapshot" && body !== undefined) {
    const form = new FormData();
    form.append("snapshot", new Blob([body], { type: "text/html" }), "snapshot.html");
    init.body = form;
  }
  const res = await fetch(`${API_BASE}${path}`, init);
  return {
    ok: res.ok,
    status: res.status,
    headers: pickHeaders(res.headers),
    bodyText: await res.text(),
  };
};

let activeTransport: Transport = fetchTransport;

/** main.tsx가 주입 태그의 data-transport 속성을 보고 부트 시 1회 교체한다. */
export function setTransport(transport: Transport): void {
  activeTransport = transport;
}

export function request(req: TransportRequest): Promise<TransportResponse> {
  return activeTransport(req);
}

interface BridgeResponseMessage {
  type: typeof BRIDGE_RESPONSE_TYPE;
  id: number;
  response?: TransportResponse;
  error?: string;
}

/**
 * 경로 D 브리지 transport — content script(확장)가 같은 window에서 응답을 되쏜다.
 * 타임아웃을 두는 이유: 확장이 비활성화·제거된 페이지에서 요청이 영원히 매달리면
 * 오프라인 큐(ID-05)로도 못 넘어간다 — 실패로 떨어뜨려 큐가 받게 한다.
 */
export function createBridgeTransport(timeoutMs = 30000): Transport {
  let seq = 0;
  const pending = new Map<number, { resolve: (r: TransportResponse) => void; reject: (e: Error) => void }>();

  window.addEventListener("message", (ev: MessageEvent) => {
    // 같은 window의 메시지만. null 허용은 happy-dom(테스트) 호환 — 실브라우저 same-window는 항상 window
    if (ev.source !== window && ev.source !== null) return;
    const data = ev.data as BridgeResponseMessage | null;
    if (!data || data.type !== BRIDGE_RESPONSE_TYPE) return;
    const waiter = pending.get(data.id);
    if (!waiter) return;
    pending.delete(data.id);
    if (data.response) waiter.resolve(data.response);
    else waiter.reject(new Error(data.error ?? "확장 브리지 오류"));
  });

  return (req) =>
    new Promise<TransportResponse>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      window.postMessage({ type: BRIDGE_REQUEST_TYPE, id, req }, "*");
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("확장 응답 시간 초과 — 확장이 활성화되어 있는지 확인하세요."));
        }
      }, timeoutMs);
    });
}
