/** SPA route 감지 (FR-EDT-06, 킥오프 §11 16차). */

export function currentRoute(): string {
  return location.pathname + location.search + location.hash;
}

/**
 * history API와 브라우저 탐색 이벤트를 한 경로 변경 스트림으로 합친다.
 * 같은 route로 replaceState하는 등 URL 값이 바뀌지 않은 호출은 알리지 않는다.
 */
export function observeRouteChanges(onChange: (route: string) => void): () => void {
  let previous = currentRoute();

  const check = () => {
    const next = currentRoute();
    if (next === previous) return;
    previous = next;
    onChange(next);
  };

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  const pushState: History["pushState"] = function (
    this: History,
    ...args: Parameters<History["pushState"]>
  ): void {
    originalPushState.apply(this, args);
    check();
  };

  const replaceState: History["replaceState"] = function (
    this: History,
    ...args: Parameters<History["replaceState"]>
  ): void {
    originalReplaceState.apply(this, args);
    check();
  };

  history.pushState = pushState;
  history.replaceState = replaceState;
  window.addEventListener("popstate", check);
  window.addEventListener("hashchange", check);

  return () => {
    window.removeEventListener("popstate", check);
    window.removeEventListener("hashchange", check);
    // 다른 코드가 뒤에서 다시 감쌌다면 그 래퍼를 덮어쓰지 않는다.
    if (history.pushState === pushState) history.pushState = originalPushState;
    if (history.replaceState === replaceState) history.replaceState = originalReplaceState;
  };
}
