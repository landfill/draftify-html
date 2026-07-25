import { injectMockupHtml, isHtmlPath } from "../inject.js";
import { LIMITS, formatMb } from "../abuse/limits.js";
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

/** 업로드 한도 초과 — 콘솔 UI가 메시지를 그대로 보여준다. */
export class IntakeLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntakeLimitError";
  }
}

/**
 * 해제 결과가 한도 안인지 본다 (W8, 킥오프 §7.5).
 *
 * 이 게이트는 **UX용**이다 — 신뢰 경계는 서버의 complete 라우트(technical-spec §7.4). 여기서 막는
 * 이유는 50MB를 다 올린 뒤 거부당하는 왕복을 없애기 위함이다.
 */
export function assertExtractedWithinLimits(files: Map<string, Uint8Array>): void {
  if (files.size > LIMITS.mockupMaxFileCount) {
    throw new IntakeLimitError(
      `목업 파일 수가 한도(${LIMITS.mockupMaxFileCount}개)를 초과합니다 — ${files.size}개.`,
    );
  }
  let totalBytes = 0;
  for (const data of files.values()) totalBytes += data.byteLength;
  if (totalBytes > LIMITS.mockupMaxTotalBytes) {
    throw new IntakeLimitError(
      `목업 해제 후 총 크기가 한도(${formatMb(LIMITS.mockupMaxTotalBytes)})를 초과합니다 — ${formatMb(totalBytes)}.`,
    );
  }
}

/** zip 원본 크기 게이트 — 해제 전에 본다. */
export function assertZipWithinLimits(zipBytes: number): void {
  if (zipBytes > LIMITS.zipMaxBytes) {
    throw new IntakeLimitError(
      `zip 파일이 ${formatMb(LIMITS.zipMaxBytes)} 제한을 초과합니다 — ${formatMb(zipBytes)}.`,
    );
  }
}

/**
 * zip → 해제 → HTML 주입까지. Storage 업로드·complete API 호출은 uploadMockupIntake가 담당.
 */
export async function prepareZipIntake(
  zipBuffer: Uint8Array,
  projectId: string,
): Promise<IntakePrepareResult> {
  assertZipWithinLimits(zipBuffer.byteLength);
  const { files, result } = await extractZipBuffer(zipBuffer);
  assertExtractedWithinLimits(files);
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
