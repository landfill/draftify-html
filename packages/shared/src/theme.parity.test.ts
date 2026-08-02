import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEME_TOKENS, themeTokenDeclarations, type ThemeMode } from "./theme.js";

/**
 * 이슈 #87 F-02 — 같은 팔레트가 두 배포에 손으로 복제돼 있었고, 갈라져도 잡아주는 것이
 * 없었다. 이 테스트가 그 역할을 한다 (`docs/ui-standard.md` 4.7절).
 *
 * 검사 대상이 둘인 이유는 두 배포가 CSS를 담는 방식이 다르기 때문이다:
 * - 사내판 `shell.ts`는 TS 템플릿 문자열이라 `themeTokenDeclarations()`로 **찍을 수 있다**
 *   → 값이 다시 하드코딩되지 않았는지만 본다
 * - 공개판 `globals.css`는 실제 `.css` 파일이라 손으로 유지한다 → **값 하나하나 대조**한다
 *
 * 정본이 `shared`이므로 검사도 여기 둔다. 소비처마다 두면 새 소비처가 생길 때 빠진다.
 */

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string): string => readFileSync(repoRoot + path, "utf8");

/** 테마가 아니라 레이아웃 값이라 `THEME_TOKENS`에 없다 — 라이트/다크 구분도 없다. */
const LAYOUT_TOKENS = ["--c-label-w", "--c-row-gap"];

/**
 * `selector { ... }` 블록 안의 `--c-*` 선언을 뽑는다.
 *
 * 중첩 블록이 없는 평평한 CSS라 첫 `}`까지가 블록이다. 이 가정이 깨지면
 * (미디어 쿼리 안으로 옮기는 등) 여기서 먼저 실패하므로 조용히 통과하지는 않는다.
 */
function extractTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, `${selector} 블록을 찾지 못했다`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  expect(close, `${selector} 블록이 닫히지 않았다`).toBeGreaterThan(open);

  const body = css.slice(open + 1, close);
  const found: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = /^\s*(--[\w-]+)\s*:\s*(.+?);\s*$/.exec(line);
    if (m && !LAYOUT_TOKENS.includes(m[1]!)) found[m[1]!] = m[2]!.trim();
  }
  return found;
}

describe("테마 토큰 단일 원천 (#87 F-02)", () => {
  it("라이트와 다크가 같은 토큰 집합을 갖는다", () => {
    // 타입으로도 막고 있지만(dark는 Record<keyof light, string>), 값 쪽 실수는 타입이
    // 잡지 못하는 경우가 있어 런타임으로도 고정한다.
    expect(Object.keys(THEME_TOKENS.dark).sort()).toEqual(Object.keys(THEME_TOKENS.light).sort());
  });

  it("선언 헬퍼는 CSS 한 줄씩 찍고 끝에 줄바꿈을 남기지 않는다", () => {
    const css = themeTokenDeclarations("light");
    expect(css.startsWith("  --c-bg: #f8fafc;")).toBe(true);
    expect(css.endsWith(";")).toBe(true);
    expect(css.split("\n")).toHaveLength(Object.keys(THEME_TOKENS.light).length);
  });

  describe("공개판 globals.css", () => {
    const css = read("apps/web/app/globals.css");

    for (const [mode, selector] of [
      ["light", ":root {"],
      ["dark", ':root[data-theme="dark"] {'],
    ] as [ThemeMode, string][]) {
      it(`${mode} 블록이 THEME_TOKENS와 일치한다`, () => {
        // toEqual이라 누락·초과·값 불일치가 한 번에 잡힌다 — 어느 쪽이 갈렸는지도 보인다.
        expect(extractTokens(css, selector)).toEqual(THEME_TOKENS[mode]);
      });
    }
  });

  it("사내판 shell.ts에 토큰 값이 다시 하드코딩되지 않았다", () => {
    // shell.ts는 헬퍼로 찍으므로 자동으로 일치한다. 위험은 누군가 값을 손으로 되돌려 넣는
    // 것이고, 그러면 globals.css 파리티를 통과하면서도 사내판만 갈라진다.
    const source = read("packages/server/src/routes/shell.ts");
    const hardcoded = source.match(/^\s*--c-[\w-]+\s*:/gm) ?? [];
    expect(hardcoded, `shell.ts는 themeTokenDeclarations()를 써야 한다`).toEqual([]);
  });
});
