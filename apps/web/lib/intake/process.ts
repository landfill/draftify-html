import { injectMockupHtml, isHtmlPath } from "../inject.js";
import type { ExtractResult, MockupManifest, ProcessedFile } from "./types.js";
import { extractZipBuffer } from "./extract.js";

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
};

function contentTypeForPath(relativePath: string): string {
  const dot = relativePath.lastIndexOf(".");
  const ext = dot >= 0 ? relativePath.slice(dot).toLowerCase() : "";
  return MIME[ext] ?? "application/octet-stream";
}

function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(data);
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** unzip 결과에 SDK·base 주입을 적용해 업로드 목록을 만든다. */
export function processExtractedFiles(
  files: Map<string, Uint8Array>,
  projectId: string,
): ProcessedFile[] {
  const out: ProcessedFile[] = [];
  for (const [path, data] of files) {
    if (isHtmlPath(path)) {
      const html = injectMockupHtml(decodeUtf8(data), projectId);
      out.push({ path, data: encodeUtf8(html), contentType: contentTypeForPath(path) });
    } else {
      out.push({ path, data, contentType: contentTypeForPath(path) });
    }
  }
  return out;
}

export interface IntakePrepareResult {
  files: ProcessedFile[];
  manifest: MockupManifest;
  extract: ExtractResult;
}

/**
 * zip → 해제 → HTML 주입까지. Storage 업로드·complete API 호출은 uploadMockupIntake가 담당.
 */
export async function prepareZipIntake(
  zipBuffer: Uint8Array,
  projectId: string,
): Promise<IntakePrepareResult> {
  const { files, result } = await extractZipBuffer(zipBuffer);
  if (!files.has("index.html")) {
    throw new Error("index.html required at mockup root");
  }
  const processed = processExtractedFiles(files, projectId);
  const manifest: MockupManifest = {
    entries: processed.map((f) => f.path).sort(),
    indexPath: "index.html",
    excluded: result.excluded,
    ...(result.strippedRoot ? { strippedRoot: result.strippedRoot } : {}),
  };
  return { files: processed, manifest, extract: result };
}
