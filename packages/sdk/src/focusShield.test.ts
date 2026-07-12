// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { shieldFocusEvents } from "./focusShield.js";

/**
 * 포커스 차단 — Shadow 호스트로 향하는 focus 이벤트가 document **캡처** 핸들러(프레임워크
 * 포커스 트랩)까지 도달하지 않아야 한다 (경로 D 실사용 — Nexacro).
 */

afterEach(() => {
  document.body.innerHTML = "";
});

function makeHostWithShadowInput(): { host: HTMLElement; input: HTMLInputElement } {
  const host = document.createElement("div");
  host.setAttribute("data-mockspec-root", "");
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  const input = document.createElement("input");
  shadow.appendChild(input);
  return { host, input };
}

describe("shieldFocusEvents (window 캡처)", () => {
  it("패널 입력의 focusin이 document 캡처 핸들러에 도달하지 않는다", () => {
    const { host, input } = makeHostWithShadowInput();
    shieldFocusEvents(host);

    let pageSaw = false;
    const pageHandler = (): void => { pageSaw = true; }; // 프레임워크 트랩(캡처)
    document.addEventListener("focusin", pageHandler, true);

    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    expect(pageSaw).toBe(false);

    document.removeEventListener("focusin", pageHandler, true);
  });

  it("페이지 요소의 포커스는 통과시킨다 (우리 호스트 밖은 차단 안 함)", () => {
    const { host } = makeHostWithShadowInput();
    shieldFocusEvents(host);
    const pageInput = document.createElement("input");
    document.body.appendChild(pageInput);

    let pageSaw = false;
    const pageHandler = (): void => { pageSaw = true; };
    document.addEventListener("focusin", pageHandler, true);

    pageInput.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
    expect(pageSaw).toBe(true); // 페이지 정상 포커스는 방해하지 않는다

    document.removeEventListener("focusin", pageHandler, true);
  });

  it("입력칸의 mousedown은 차단(클릭 포커스 복원)하지만 비입력(마커 등)은 통과(드래그 보존)", () => {
    const host = document.createElement("div");
    host.setAttribute("data-mockspec-root", "");
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    const select = document.createElement("select"); // 전이 드롭다운 (T27)
    const marker = document.createElement("button"); // 마커류
    shadow.append(input, select, marker);
    shieldFocusEvents(host);

    const seen: string[] = [];
    const pageHandler = (e: Event): void => { seen.push((e.composedPath()[0] as HTMLElement).tagName); };
    document.addEventListener("mousedown", pageHandler, true); // 프레임워크의 preventDefault 흉내

    input.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    marker.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));

    expect(seen).toEqual(["BUTTON"]); // 입력칸·드롭다운은 페이지에 안 감(차단), 마커(BUTTON)는 통과
    document.removeEventListener("mousedown", pageHandler, true);
  });
});
