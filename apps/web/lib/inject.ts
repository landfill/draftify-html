import { RESERVED_PATH_PREFIX, PROJECT_DATA_ATTR } from "@mockspec/shared";

/**
 * text/html에 SDK 로더 태그를 삽입한다 (D6·technical-spec §3.2).
 * packages/server/src/inject.ts 와 동일 계약 — 인제스트 시 1회 적용 후 정적 서빙.
 */
export function injectSdkTag(html: string, projectId: string): string {
  const tag =
    `<script src="${RESERVED_PATH_PREFIX}/sdk.js" ` +
    `${PROJECT_DATA_ATTR}="${projectId}" defer></script>`;

  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + tag;
  return html.slice(0, idx) + tag + html.slice(idx);
}

/** 경로 격리용 base href. 기존 `<base>`가 있으면 교체(첫 base만 인정 — 단순 추가 금지). */
export function setBaseHref(html: string, projectId: string): string {
  const href = `/m/${projectId}/`;
  const baseTag = `<base href="${href}">`;
  const baseRe = /<base\s[^>]*>/i;
  if (baseRe.test(html)) return html.replace(baseRe, baseTag);

  const headRe = /<head(\s[^>]*)?>/i;
  if (headRe.test(html)) return html.replace(headRe, (m) => `${m}\n  ${baseTag}`);
  return `${baseTag}\n${html}`;
}

/** HTML 목업 파일에 SDK·base를 모두 적용한다. */
export function injectMockupHtml(html: string, projectId: string): string {
  return injectSdkTag(setBaseHref(html, projectId), projectId);
}

const HTML_EXT = /\.(html?)$/i;

export function isHtmlPath(relativePath: string): boolean {
  return HTML_EXT.test(relativePath);
}

/** 주입본 검증 — manifest complete API·단위 테스트 공용. */
export function assertInjectedHtml(html: string, projectId: string): void {
  const sdkNeedle = `${RESERVED_PATH_PREFIX}/sdk.js`;
  if (!html.includes(sdkNeedle) || !html.includes(`${PROJECT_DATA_ATTR}="${projectId}"`)) {
    throw new Error("SDK injection missing");
  }
  const bases = html.match(/<base\s[^>]*>/gi) ?? [];
  if (bases.length !== 1) throw new Error("expected exactly one <base> tag");
  const expected = `href="/m/${projectId}/"`;
  if (!bases[0]!.toLowerCase().includes(expected)) {
    throw new Error(`<base> href must be ${expected}`);
  }
}
