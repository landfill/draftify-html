import { WORKING_NAME } from "@mockspec/shared";

/**
 * 콘솔 계열 페이지(콘솔·가이드·FAQ) 공통 셸 — 테마 변수·헤더·다크 모드 토글.
 *
 * 테마는 CSS 변수 2벌(라이트 기본, `:root[data-theme="dark"]` 오버라이드)로 구현한다.
 * 선택은 localStorage("mockspec:theme")에 남기고, FOUC를 막기 위해
 * `THEME_INIT_JS`를 <head>에서 스타일보다 먼저 실행한다.
 */

export const SHELL_CSS = `
:root {
  color-scheme: light;
  --c-bg: #f8fafc;
  --c-surface: #fff;
  --c-surface-2: #f8fafc;
  --c-chip: #f1f5f9;
  --c-border: #e2e8f0;
  --c-border-2: #cbd5e1;
  --c-border-hover: #94a3b8;
  --c-text: #0f172a;
  --c-text-2: #334155;
  --c-text-3: #475569;
  --c-muted: #64748b;
  --c-faint: #94a3b8;
  --c-accent: #4f46e5;
  --c-btn-bg: #4f46e5;
  --c-btn-bg-hover: #4338ca;
  --c-accent-focus: #6366f1;
  --c-accent-ring: rgba(99, 102, 241, 0.15);
  --c-danger: #e11d48;
  --c-danger-solid: #e11d48;
  --c-danger-text: #be123c;
  --c-danger-bg: #fff1f2;
  --c-danger-border: #fecdd3;
  --c-danger-border-2: #fda4af;
  --c-ok-text: #15803d;
  --c-ok-bg: #f0fdf4;
  --c-ok-border: #bbf7d0;
  --c-overlay: rgba(15, 23, 42, 0.5);
  --c-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  font-family: Pretendard, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--c-text);
  background: var(--c-bg);
  min-height: 100vh;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --c-bg: #0f172a;
  --c-surface: #1e293b;
  --c-surface-2: #26334a;
  --c-chip: #334155;
  --c-border: #334155;
  --c-border-2: #475569;
  --c-border-hover: #64748b;
  --c-text: #f1f5f9;
  --c-text-2: #e2e8f0;
  --c-text-3: #cbd5e1;
  --c-muted: #94a3b8;
  --c-faint: #64748b;
  --c-accent: #a5b4fc;
  --c-btn-bg: #6366f1;
  --c-btn-bg-hover: #818cf8;
  --c-accent-focus: #818cf8;
  --c-accent-ring: rgba(129, 140, 248, 0.25);
  --c-danger: #fb7185;
  --c-danger-solid: #e11d48;
  --c-danger-text: #fda4af;
  --c-danger-bg: rgba(244, 63, 94, 0.12);
  --c-danger-border: rgba(244, 63, 94, 0.35);
  --c-danger-border-2: rgba(244, 63, 94, 0.5);
  --c-ok-text: #4ade80;
  --c-ok-bg: rgba(34, 197, 94, 0.12);
  --c-ok-border: rgba(34, 197, 94, 0.35);
  --c-overlay: rgba(2, 6, 23, 0.7);
  --c-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; min-height: 100vh; background: transparent; font-size: 11.5px; line-height: 1.5; }
button, input { font: inherit; }

.c-header {
  display: flex; justify-content: space-between; align-items: center;
  height: 56px; background: var(--c-surface); border-bottom: 1px solid var(--c-border); padding: 0 32px;
}
.c-logo { font-size: 16px; font-weight: 800; color: var(--c-text); letter-spacing: -0.4px; text-decoration: none; }
.c-header-right { display: flex; gap: 24px; align-items: center; }
.c-nav-link { font-size: 13px; color: var(--c-text-3); text-decoration: none; font-weight: 500; }
.c-nav-link:hover { color: var(--c-text); }
.c-nav-link.is-active { color: var(--c-accent); font-weight: 600; }
.c-theme-toggle {
  border: 1px solid var(--c-border-2); background: var(--c-surface); border-radius: 999px;
  width: 30px; height: 30px; padding: 0; cursor: pointer; font-size: 14px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.c-theme-toggle:hover { border-color: var(--c-border-hover); background: var(--c-surface-2); }
.c-theme-toggle::before { content: "🌙"; }
:root[data-theme="dark"] .c-theme-toggle::before { content: "☀️"; }

.c-shell { max-width: 1080px; margin: 0 auto; padding: 48px 32px 80px; }
.c-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  box-shadow: var(--c-shadow);
  border-radius: 10px;
  padding: 28px 32px;
  margin-bottom: 32px;
}
.c-section { margin-bottom: 36px; }
.c-section-title { display: flex; align-items: center; gap: 8px; margin: 0 0 12px 4px; font-size: 13px; font-weight: 700; color: var(--c-text); letter-spacing: -0.2px; }
`.trim();

/**
 * 저장된 테마를 첫 페인트 전에 적용 (FOUC 방지). <head>에서 스타일보다 먼저 인라인 실행.
 * (콘솔과 동일하게 백틱·\${ 사용 금지 — 아우터 템플릿 리터럴과의 충돌 방지)
 */
export const THEME_INIT_JS = `
(function () {
  try {
    if (localStorage.getItem("mockspec:theme") === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  } catch (e) { /* localStorage 불가 환경은 라이트 기본 */ }
})();
`.trim();

/** 헤더의 다크 모드 토글 배선. 각 페이지 <script> 맨 앞에 포함한다. */
export const THEME_TOGGLE_JS = `
(function () {
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  // 아이콘은 CSS ::before가 data-theme 기준으로 그린다 (첫 페인트 깜빡임 방지) — JS는 접근성 라벨만
  function syncIcon() {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    toggle.setAttribute("aria-label", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
    toggle.setAttribute("title", dark ? "라이트 모드로 전환" : "다크 모드로 전환");
  }
  toggle.addEventListener("click", function () {
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    if (dark) document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", "dark");
    try { localStorage.setItem("mockspec:theme", dark ? "light" : "dark"); } catch (e) { /* 무시 */ }
    syncIcon();
  });
  syncIcon();
})();
`.trim();

/** 공통 헤더. active는 현재 페이지의 내비 링크 하이라이트. */
export function pageHeader(active?: "guide" | "faq"): string {
  const cls = (name: "guide" | "faq"): string =>
    active === name ? "c-nav-link is-active" : "c-nav-link";
  return `
  <header class="c-header">
    <div class="c-header-left">
      <a href="/" class="c-logo">${WORKING_NAME}</a>
    </div>
    <div class="c-header-right">
      <a href="/guide" class="${cls("guide")}">사용 가이드</a>
      <a href="/sample" class="c-nav-link" target="_blank" rel="noopener">샘플 보기</a>
      <a href="/faq" class="${cls("faq")}">FAQ</a>
      <button type="button" id="theme-toggle" class="c-theme-toggle" aria-label="다크 모드로 전환" title="다크 모드로 전환"></button>
    </div>
  </header>`.trim();
}
