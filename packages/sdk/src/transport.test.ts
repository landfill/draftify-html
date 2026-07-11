// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { BRIDGE_REQUEST_TYPE, BRIDGE_RESPONSE_TYPE } from "@mockspec/shared";
import { createBridgeTransport, type TransportResponse } from "./transport.js";

/**
 * T23: 경로 D 브리지 transport — postMessage 요청/응답 상관관계와 타임아웃.
 * content script 역할은 같은 window에 응답을 되쏘는 가짜 리스너로 대신한다.
 */

interface BridgeRequestMessage {
  type: typeof BRIDGE_REQUEST_TYPE;
  id: number;
  req: { path: string; method: string; body?: string; bodyType?: string };
}

function fakeContentScript(handler: (req: BridgeRequestMessage["req"]) => TransportResponse | { error: string }): () => void {
  const listener = (ev: MessageEvent): void => {
    const data = ev.data as BridgeRequestMessage | null;
    if (!data || data.type !== BRIDGE_REQUEST_TYPE) return;
    const result = handler(data.req);
    const payload =
      "error" in result
        ? { type: BRIDGE_RESPONSE_TYPE, id: data.id, error: result.error }
        : { type: BRIDGE_RESPONSE_TYPE, id: data.id, response: result };
    // postMessage 대신 직접 dispatch(source: null) — vitest happy-dom은 window가 프록시라
    // postMessage의 ev.source가 transport의 same-window 가드(ev.source === window)와 불일치한다.
    // 실브라우저 검증은 T22/T23 스크래치(실 Chromium)가 커버.
    window.dispatchEvent(new MessageEvent("message", { data: payload }));
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

describe("브리지 transport (경로 D, T23)", () => {
  it("요청을 postMessage로 보내고 상관된 응답을 받는다 — 동시 요청 2건 교차 없음", async () => {
    const stop = fakeContentScript((req) => ({
      ok: true,
      status: 200,
      headers: {},
      bodyText: JSON.stringify({ echoedPath: req.path, method: req.method }),
    }));
    try {
      const transport = createBridgeTransport();
      const [a, b] = await Promise.all([
        transport({ path: "/projects/prj_a", method: "GET" }),
        transport({ path: "/projects/prj_b", method: "PUT", body: "{}", bodyType: "json" }),
      ]);
      expect(JSON.parse(a.bodyText).echoedPath).toBe("/projects/prj_a");
      expect(JSON.parse(b.bodyText).echoedPath).toBe("/projects/prj_b");
      expect(JSON.parse(b.bodyText).method).toBe("PUT");
    } finally {
      stop();
    }
  });

  it("확장이 오류를 되쏘면 reject된다", async () => {
    const stop = fakeContentScript(() => ({ error: "이 사이트에 연결된 프로젝트가 없습니다." }));
    try {
      const transport = createBridgeTransport();
      await expect(transport({ path: "/projects/prj_x", method: "GET" })).rejects.toThrow(
        "이 사이트에 연결된 프로젝트가 없습니다."
      );
    } finally {
      stop();
    }
  });

  it("응답이 없으면 타임아웃으로 실패해 오프라인 큐가 받을 수 있다", async () => {
    // 리스너 없음 — 아무도 응답하지 않는 상황 (확장 비활성화)
    const transport = createBridgeTransport(50);
    await expect(transport({ path: "/projects/prj_x", method: "GET" })).rejects.toThrow("확장 응답 시간 초과");
  });
});
