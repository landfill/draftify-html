// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentRoute, observeRouteChanges } from "./routeChanges.js";

let stop: (() => void) | undefined;

beforeEach(() => {
  history.replaceState(null, "", "/start");
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.restoreAllMocks();
});

describe("SPA route 변경 감지 (FR-EDT-06)", () => {
  it("pathname+search+hash의 실제 변경만 알린다", () => {
    const routes: string[] = [];
    stop = observeRouteChanges((route) => routes.push(route));

    history.pushState(null, "", "/stats?tab=all#summary");
    history.replaceState(null, "", "/stats?tab=all#summary"); // 같은 값은 무시
    history.replaceState(null, "", "/stats?tab=done#summary");

    expect(routes).toEqual(["/stats?tab=all#summary", "/stats?tab=done#summary"]);
    expect(currentRoute()).toBe("/stats?tab=done#summary");
  });

  it("뒤로가기(popstate)와 hashchange를 감지한다", () => {
    history.pushState(null, "", "/one");
    history.pushState(null, "", "/two");
    const routes: string[] = [];
    stop = observeRouteChanges((route) => routes.push(route));

    history.back();
    expect(routes).toEqual(["/one"]);

    location.hash = "detail";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(routes).toEqual(["/one", "/one#detail"]);
  });

  it("해제하면 history 원본을 복원하고 더 이상 알리지 않는다", () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const listener = vi.fn();
    stop = observeRouteChanges(listener);

    expect(history.pushState).not.toBe(originalPushState);
    expect(history.replaceState).not.toBe(originalReplaceState);
    stop();
    stop = undefined;

    expect(history.pushState).toBe(originalPushState);
    expect(history.replaceState).toBe(originalReplaceState);
    history.pushState(null, "", "/after-stop");
    expect(listener).not.toHaveBeenCalled();
  });
});
