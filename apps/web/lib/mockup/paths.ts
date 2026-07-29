import { isSafeMockupPath } from "../intake/extract.js";

const PROJECT_ID_RE = /^prj_[0-9a-z]{10}$/;

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_RE.test(id);
}

/**
 * URL catch-all 세그먼트 → Storage 상대 경로.
 * 빈 경로·루트는 index.html (serve.ts 디렉토리 기본과 동일).
 */
export function resolveMockupRelativePath(segments: string[] | undefined): string | null {
  if (!segments || segments.length === 0) return "index.html";

  const decoded = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return null;
    }
  });
  if (decoded.some((s) => s === null)) return null;

  const joined = decoded.join("/");
  if (!isSafeMockupPath(joined)) return null;
  return joined;
}

/** 디렉토리 URL(끝 /)이면 index.html을 시도한다. */
export function directoryIndexPath(relativePath: string): string {
  if (relativePath.endsWith("/")) return `${relativePath}index.html`;
  return relativePath;
}
