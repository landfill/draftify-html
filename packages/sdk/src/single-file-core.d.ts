/**
 * single-file-core는 타입을 제공하지 않는다. 우리가 쓰는 진입점(getPageData)만 선언한다.
 * 번들에는 Vite/esbuild가 실제 구현을 포함하고, tsc는 이 선언으로 타입만 맞춘다.
 */
declare module "single-file-core/single-file.js" {
  export interface PageData {
    content: string;
    title?: string;
    filename?: string;
    doctype?: string;
  }
  export function getPageData(
    options?: Record<string, unknown>,
    initOptions?: Record<string, unknown>,
    doc?: Document,
    win?: Window & typeof globalThis,
  ): Promise<PageData>;
  export function init(initOptions?: Record<string, unknown>): void;
}
