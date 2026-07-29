import { unzip } from "fflate";
import type { ExtractResult } from "./types.js";

/** zip-slip 감지 시 던진다 — 해당 zip 전체를 거부한다 (technical-spec §7.1). */
export class ZipSlipError extends Error {
  constructor(public readonly entryPath: string) {
    super(`zip entry escapes target directory: ${entryPath}`);
    this.name = "ZipSlipError";
  }
}

type ExcludeRule =
  | { kind: "dirSegment"; segment: string; label: string }
  | { kind: "basename"; name: string; label: string }
  | { kind: "extension"; ext: string; label: string };

const EXCLUDE_RULES: ExcludeRule[] = [
  { kind: "dirSegment", segment: "node_modules", label: "node_modules/" },
  { kind: "dirSegment", segment: ".git", label: ".git/" },
  { kind: "dirSegment", segment: "__MACOSX", label: "__MACOSX/" },
  { kind: "basename", name: ".DS_Store", label: ".DS_Store" },
  { kind: "basename", name: "Thumbs.db", label: "Thumbs.db" },
  { kind: "extension", ext: ".map", label: "*.map" },
];

function normalizeEntryPath(raw: string): string {
  return raw.replace(/\\/g, "/").replace(/^\/+/, "");
}

function matchExclude(entryPath: string): string | null {
  const segments = entryPath.split("/").filter(Boolean);
  const base = segments[segments.length - 1] ?? "";
  for (const rule of EXCLUDE_RULES) {
    if (rule.kind === "dirSegment" && segments.includes(rule.segment)) return rule.label;
    if (rule.kind === "basename" && base === rule.name) return rule.label;
    if (rule.kind === "extension" && base.toLowerCase().endsWith(rule.ext)) return rule.label;
  }
  return null;
}

function commonRootPrefix(paths: string[]): string[] {
  if (paths.length === 0) return [];
  const split = paths.map((p) => p.split("/").filter(Boolean));
  const prefix: string[] = [];
  const maxDepth = Math.min(...split.map((s) => s.length)) - 1;
  for (let depth = 0; depth < maxDepth; depth++) {
    const segment = split[0]![depth]!;
    if (segment === ".." || segment === ".") break;
    if (!split.every((s) => s[depth] === segment)) break;
    prefix.push(segment);
  }
  return prefix;
}

/** manifest·Storage 경로에 쓸 상대 경로가 안전한지 검사한다. */
export function isSafeMockupPath(relativePath: string): boolean {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")) return false;
  const segments = relativePath.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) return false;
  return true;
}

function assertSafeRelative(relative: string, originalEntry: string): void {
  if (!isSafeMockupPath(relative)) throw new ZipSlipError(originalEntry);
}

function unzipAsync(buffer: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(buffer, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

export interface ExtractedZip {
  files: Map<string, Uint8Array>;
  result: ExtractResult;
}

/**
 * zip 버퍼를 브라우저(또는 vitest)에서 메모리로 해제한다.
 * packages/server/src/unzip/extract.ts 와 동일 규칙(zip-slip·제외·최상위 언랩).
 */
export async function extractZipBuffer(buffer: Uint8Array): Promise<ExtractedZip> {
  const raw = await unzipAsync(buffer);
  const excludedCounts = new Map<string, number>();
  const included: { path: string; data: Uint8Array }[] = [];

  for (const [entryPath, data] of Object.entries(raw)) {
    const normalized = normalizeEntryPath(entryPath);
    if (!normalized || normalized.endsWith("/")) continue;

    const label = matchExclude(normalized);
    if (label) {
      excludedCounts.set(label, (excludedCounts.get(label) ?? 0) + 1);
      continue;
    }
    included.push({ path: normalized, data });
  }

  const prefix = commonRootPrefix(included.map((e) => e.path));
  const files = new Map<string, Uint8Array>();

  for (const entry of included) {
    const relative = entry.path.split("/").filter(Boolean).slice(prefix.length).join("/");
    assertSafeRelative(relative, entry.path);
    files.set(relative, entry.data);
  }

  const excluded = [...excludedCounts.entries()].map(([pattern, count]) => ({ pattern, count }));
  const result: ExtractResult = { fileCount: files.size, excluded };
  if (prefix.length > 0) result.strippedRoot = prefix.join("/");
  return { files, result };
}
