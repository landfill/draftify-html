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
 * zip 버퍼를 destDir로 안전하게 해제한다.
 * - zip-slip: 정규화된 대상 경로가 destDir 밖이면 ZipSlipError로 zip 전체 거부
 * - 제외 필터: EXCLUDE_RULES에 걸리는 엔트리는 디스크에 쓰지 않음 (집계만)
 *
 * Open.buffer를 쓰는 이유: 제외 대상은 `.buffer()`를 호출하지 않으면 압축 해제 자체가
 * 일어나지 않아 스트리밍 autodrain과 동일하게 "디스크에 쓰지 않음"이 보장된다. 테스트도 쉽다.
 */
export async function extractZip(buffer: Buffer, destDir: string): Promise<ExtractResult> {
  const directory = await unzipper.Open.buffer(buffer);
  const resolvedDest = path.resolve(destDir);
  const excludedCounts = new Map<string, number>();
  let fileCount = 0;

  for (const entry of directory.files) {
    if (entry.type === "Directory") continue;

    const label = matchExclude(entry.path);
    if (label) {
      excludedCounts.set(label, (excludedCounts.get(label) ?? 0) + 1);
      continue;
    }

    // zip-slip: 대상 절대경로가 destDir 안에 있는지 검증
    const target = path.resolve(resolvedDest, entry.path);
    if (target !== resolvedDest && !target.startsWith(resolvedDest + path.sep)) {
      throw new ZipSlipError(entry.path);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await entry.buffer());
    fileCount++;
  }

  const excluded = [...excludedCounts.entries()].map(([pattern, count]) => ({ pattern, count }));
  return { fileCount, excluded };
}
