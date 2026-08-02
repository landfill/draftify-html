/**
 * 테마 색 토큰의 단일 원천 (이슈 #87 F-02 / `docs/ui-standard.md` 4.7절).
 *
 * 같은 팔레트가 공개판 `apps/web/app/globals.css`와 사내판
 * `packages/server/src/routes/shell.ts`에 **손으로 복제돼** 있었다. 값이 우연히 일치할 뿐
 * 한쪽만 고치면 조용히 갈라지고, 그걸 잡아주는 것이 없었다.
 *
 * 여기를 정본으로 삼는다:
 * - 사내판(`shell.ts`)은 `themeTokenDeclarations()`로 **직접 찍는다** — 복제가 사라진다
 * - 공개판(`globals.css`)은 실제 `.css` 파일이라 그대로 두고, **파리티 테스트가 묶는다**
 *   (`apps/web/app/globals.theme-parity.test.ts`). CSS를 JS로 주입하면 FOUC와 SSR 복잡도를
 *   사는 대신 얻는 것이 없다 (4.7절)
 *
 * 색이 아닌 값은 여기 넣지 않는다. `--c-label-w`·`--c-row-gap`은 테마와 무관한 레이아웃
 * 값이고 라이트/다크 구분이 없어, 공개판은 `globals.css`의 `:root`에, 사내판은 콘솔에만
 * 필요하므로 `console.ts`의 별도 `:root`에 둔다. 파리티 테스트가 이 둘을 예외로 다룬다.
 *
 * 대비를 바꿀 때는 `docs/ui-standard.md` 6.3절의 계산표를 다시 채운다 — `--c-muted`는
 * 라이트 `#f8fafc` 배경 위에서 4.55:1로 AA 기준선을 0.05만 넘긴다.
 */

const light = {
  "--c-bg": "#f8fafc",
  "--c-surface": "#fff",
  "--c-surface-2": "#f8fafc",
  "--c-chip": "#f1f5f9",
  "--c-border": "#e2e8f0",
  "--c-border-2": "#cbd5e1",
  "--c-border-hover": "#94a3b8",
  "--c-text": "#0f172a",
  "--c-text-2": "#334155",
  "--c-text-3": "#475569",
  "--c-muted": "#64748b",
  "--c-accent": "#4f46e5",
  "--c-btn-bg": "#4f46e5",
  "--c-btn-bg-hover": "#4338ca",
  "--c-accent-focus": "#6366f1",
  "--c-accent-ring": "rgba(99, 102, 241, 0.15)",
  "--c-danger": "#e11d48",
  "--c-danger-solid": "#e11d48",
  "--c-danger-text": "#be123c",
  "--c-danger-bg": "#fff1f2",
  "--c-danger-border": "#fecdd3",
  "--c-danger-border-2": "#fda4af",
  "--c-ok-text": "#15803d",
  "--c-ok-bg": "#f0fdf4",
  "--c-ok-border": "#bbf7d0",
  "--c-overlay": "rgba(15, 23, 42, 0.5)",
  "--c-shadow": "0 1px 2px rgba(0, 0, 0, 0.03)",
} as const;

/** 라이트에 있는 토큰은 다크에도 있어야 한다 — 빠지면 타입 에러다. */
const dark: Record<keyof typeof light, string> = {
  "--c-bg": "#0f172a",
  "--c-surface": "#1e293b",
  "--c-surface-2": "#26334a",
  "--c-chip": "#334155",
  "--c-border": "#334155",
  "--c-border-2": "#475569",
  "--c-border-hover": "#64748b",
  "--c-text": "#f1f5f9",
  "--c-text-2": "#e2e8f0",
  "--c-text-3": "#cbd5e1",
  "--c-muted": "#94a3b8",
  "--c-accent": "#a5b4fc",
  "--c-btn-bg": "#6366f1",
  "--c-btn-bg-hover": "#818cf8",
  "--c-accent-focus": "#818cf8",
  "--c-accent-ring": "rgba(129, 140, 248, 0.25)",
  "--c-danger": "#fb7185",
  /* 라이트와 같은 값이다 — 채움 버튼 위의 흰 글자를 위해 어두운 쪽을 유지한다. */
  "--c-danger-solid": "#e11d48",
  "--c-danger-text": "#fda4af",
  "--c-danger-bg": "rgba(244, 63, 94, 0.12)",
  "--c-danger-border": "rgba(244, 63, 94, 0.35)",
  "--c-danger-border-2": "rgba(244, 63, 94, 0.5)",
  "--c-ok-text": "#4ade80",
  "--c-ok-bg": "rgba(34, 197, 94, 0.12)",
  "--c-ok-border": "rgba(34, 197, 94, 0.35)",
  "--c-overlay": "rgba(2, 6, 23, 0.7)",
  "--c-shadow": "0 1px 2px rgba(0, 0, 0, 0.3)",
};

export const THEME_TOKENS = { light, dark } as const;

export type ThemeMode = keyof typeof THEME_TOKENS;
export type ThemeTokenName = keyof typeof light;

/**
 * 토큰 선언만 만든다 — 셀렉터·중괄호·`color-scheme`은 호출부가 쓴다.
 * 표면마다 담는 그릇이 다르기 때문이다: 사내판은 `:root`, SDK는 Shadow DOM이라 `:host`.
 *
 * 끝에 줄바꿈을 붙이지 않는다 — 템플릿 문자열에 넣을 때 빈 줄이 생긴다.
 */
export function themeTokenDeclarations(mode: ThemeMode, indent = "  "): string {
  return Object.entries(THEME_TOKENS[mode])
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join("\n");
}
