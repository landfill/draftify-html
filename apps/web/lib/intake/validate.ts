import type { Db } from "../store/ids.js";
import { assertInjectedHtml } from "../inject.js";
import { STORAGE_BUCKET, mockupObjectPath, mockupPrefix } from "../store/ids.js";
import type { MockupManifest } from "./types.js";
import { isSafeMockupPath } from "./extract.js";

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

/** manifest 본문 형식만 검사(Storage 접근 없음). */
export function validateManifestShape(manifest: MockupManifest, projectId: string): void {
  if (!manifest || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new ManifestValidationError("manifest.entries가 비어 있습니다.");
  }
  if (manifest.indexPath !== "index.html") {
    throw new ManifestValidationError("indexPath는 index.html 이어야 합니다.");
  }
  if (!manifest.entries.includes("index.html")) {
    throw new ManifestValidationError("entries에 index.html이 없습니다.");
  }
  const seen = new Set<string>();
  for (const entry of manifest.entries) {
    if (!isSafeMockupPath(entry)) {
      throw new ManifestValidationError(`안전하지 않은 경로: ${entry}`);
    }
    if (seen.has(entry)) {
      throw new ManifestValidationError(`중복 엔트리: ${entry}`);
    }
    seen.add(entry);
  }
  if (!projectId.startsWith("prj_")) {
    throw new ManifestValidationError("잘못된 projectId");
  }
}

/**
 * Storage에 올라간 주입본을 검증한다(D5·D6).
 * 서버는 파일을 만들지 않고, 클라이언트가 올린 결과만 확인한다.
 */
export async function validateMockupManifest(
  db: Db,
  projectId: string,
  manifest: MockupManifest,
): Promise<void> {
  validateManifestShape(manifest, projectId);

  const downloads = await Promise.all(
    manifest.entries.map(async (entry) => {
      const { data, error } = await db.storage
        .from(STORAGE_BUCKET)
        .download(mockupObjectPath(projectId, entry));
      if (error || !data) {
        throw new ManifestValidationError(`Storage에 없는 엔트리: ${entry}`);
      }
      return { entry, bytes: new Uint8Array(await data.arrayBuffer()) };
    }),
  );

  const index = downloads.find((d) => d.entry === manifest.indexPath);
  if (!index) throw new ManifestValidationError("index.html을 찾을 수 없습니다.");

  const indexHtml = new TextDecoder("utf-8", { fatal: false }).decode(index.bytes);
  try {
    assertInjectedHtml(indexHtml, projectId);
  } catch {
    throw new ManifestValidationError("index.html에 SDK·base 주입이 올바르지 않습니다.");
  }

  for (const { entry, bytes } of downloads) {
    if (entry === manifest.indexPath || !/\.html?$/i.test(entry)) continue;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    try {
      assertInjectedHtml(html, projectId);
    } catch {
      throw new ManifestValidationError(`${entry}에 SDK·base 주입이 올바르지 않습니다.`);
    }
  }
}

/** 검증 실패 시 부분 업로드 정리. */
export async function removeMockupPrefix(db: Db, projectId: string): Promise<void> {
  const prefix = mockupPrefix(projectId);
  const queue = [""];
  const paths: string[] = [];
  while (queue.length > 0) {
    const sub = queue.pop()!;
    const { data } = await db.storage.from(STORAGE_BUCKET).list(`${prefix}${sub}`, { limit: 1000 });
    for (const item of data ?? []) {
      const rel = sub ? `${sub}/${item.name}` : item.name;
      if (item.id) paths.push(`${prefix}/${rel}`);
      else queue.push(rel);
    }
  }
  if (paths.length > 0) await db.storage.from(STORAGE_BUCKET).remove(paths);
}
