// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { shieldFocusEvents } from "./focusShield.js";

/**
 * 포커스 차단 — Shadow 호스트 안에서 발생한 focusin/focusout이 document의 페이지
 * 핸들러(프레임워크 포커스 트랩)까지 전파되지 않아야 한다 (경로 D 실사용).
 */

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shieldFocusEvents", () => {
  it("호스트 내부 focusin이 document까지 전파되지 않는다", () => {
    const host = document.createElement("div");
    host.setAttribute("data-mockspec-root", "");
    const input = document.createElement("input");
    host.appendChild(input);
    document.body.appendChild(host);
    shieldFocusEvents(host);

    let pageSaw = false;
    const pageHandler = (): void => { pageSaw = true; }; // 페이지(프레임워크) 트랩 흉내
    document.addEventListener("focusin", pageHandler);

    // 버블하는 focusin (Shadow 경계에서 호스트로 리타깃된 것과 동형)
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(pageSaw).toBe(false); // 페이지 핸들러가 못 봄 → 포커스 가로채기 불가

    document.removeEventListener("focusin", pageHandler);
  });

  it("차단하지 않으면 document가 focusin을 본다 (대조군 — 문제 상황)", () => {
    const host = document.createElement("div");
    const input = document.createElement("input");
    host.appendChild(input);
    document.body.appendChild(host);
    // shield 미적용

    let pageSaw = false;
    const pageHandler = (): void => { pageSaw = true; };
    document.addEventListener("focusin", pageHandler);
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(pageSaw).toBe(true);
    document.removeEventListener("focusin", pageHandler);
  });
});
