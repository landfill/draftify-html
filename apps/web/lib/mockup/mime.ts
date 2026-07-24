const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

export function contentTypeForPath(relativePath: string): string {
  const dot = relativePath.lastIndexOf(".");
  const ext = dot >= 0 ? relativePath.slice(dot).toLowerCase() : "";
  return MIME[ext] ?? "application/octet-stream";
}

/** SPA history fallback 대상 — 확장자 없는 경로만 (serve.ts·FR-ONB-04). */
export function isSpaFallbackCandidate(relativePath: string): boolean {
  const slash = relativePath.lastIndexOf("/");
  const last = slash >= 0 ? relativePath.slice(slash + 1) : relativePath;
  return last !== "" && !last.includes(".");
}
