import path from "node:path";
import fs from "node:fs/promises";
import unzipper from "unzipper";

/** zip-slip 감지 시 던진다 — 해당 zip 전체를 거부한다 (technical-spec §7.1). */
export class ZipSlipError extends Error {
  constructor(public readonly entryPath: string) {
    super(`zip entry escapes target directory: ${entryPath}`);
    this.name = "ZipSlipError";
  }
}

/** 해제에서 제외할 경로 규칙. (technical-spec §3.2) */
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

export interface ExtractResult {
  fileCount: number;
  /** 제외된 항목 집계 — 업로드 응답에 실어 콘솔이 표시 (technical-spec §3.2). */
  excluded: { pattern: string; count: number }[];
  /** 언랩된 공통 최상위 디렉토리 접두 (예: "dist"). 언랩이 없었으면 생략. */
  strippedRoot?: string;
}

/** 엔트리가 제외 규칙에 걸리면 해당 규칙 label을, 아니면 null을 반환. */
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

/**
 * 모든 엔트리가 공유하는 최상위 디렉토리 체인을 구한다 (킥오프 §11 3차 개정).
 * `dist` 폴더를 통째로 압축한 zip(루트가 `dist/`)을 루트로 승격하기 위한 접두.
 * - 각 엔트리는 언랩 후에도 최소 1세그먼트(파일명)를 남긴다
 * - `..`·`.` 세그먼트는 접두로 취급하지 않는다 — zip-slip 검증을 언랩으로 우회할 수 없다
 */
function commonRootPrefix(paths: string[]): string[] {
  if (paths.length === 0) return [];
  const split = paths.map((p) => p.split("/").filter(Boolean));
  const prefix: string[] = [];
  const maxDepth = Math.min(...split.map((s) => s.length)) - 1; // 파일명은 남긴다
  for (let depth = 0; depth < maxDepth; depth++) {
    const segment = split[0][depth];
    if (segment === ".." || segment === ".") break;
    if (!split.every((s) => s[depth] === segment)) break;
    prefix.push(segment);
  }
  return prefix;
}

/**
 * zip 버퍼를 destDir로 안전하게 해제한다.
 * - zip-slip: 정규화된 대상 경로가 destDir 밖이면 ZipSlipError로 zip 전체 거부
 * - 제외 필터: EXCLUDE_RULES에 걸리는 엔트리는 디스크에 쓰지 않음 (집계만)
 * - 최상위 폴더 언랩: 제외 필터 후 모든 엔트리가 공통 최상위 디렉토리 체인을 공유하면
 *   벗겨서 루트로 승격 (technical-spec §3.2)
 *
 * Open.buffer를 쓰는 이유: 제외 대상은 `.buffer()`를 호출하지 않으면 압축 해제 자체가
 * 일어나지 않아 스트리밍 autodrain과 동일하게 "디스크에 쓰지 않음"이 보장된다. 테스트도 쉽다.
 */
export async function extractZip(buffer: Buffer, destDir: string): Promise<ExtractResult> {
  const directory = await unzipper.Open.buffer(buffer);
  const resolvedDest = path.resolve(destDir);
  const excludedCounts = new Map<string, number>();
  let fileCount = 0;

  const included: (typeof directory.files)[number][] = [];
  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;

    const label = matchExclude(entry.path);
    if (label) {
      excludedCounts.set(label, (excludedCounts.get(label) ?? 0) + 1);
      continue;
    }
    included.push(entry);
  }

  const prefix = commonRootPrefix(included.map((e) => e.path));

  for (const entry of included) {
    const relative = entry.path.split("/").filter(Boolean).slice(prefix.length).join("/");

    // zip-slip: 대상 절대경로가 destDir 안에 있는지 검증
    const target = path.resolve(resolvedDest, relative);
    if (target !== resolvedDest && !target.startsWith(resolvedDest + path.sep)) {
      throw new ZipSlipError(entry.path);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await entry.buffer());
    fileCount++;
  }

  const excluded = [...excludedCounts.entries()].map(([pattern, count]) => ({ pattern, count }));
  const result: ExtractResult = { fileCount, excluded };
  if (prefix.length > 0) result.strippedRoot = prefix.join("/");
  return result;
}
