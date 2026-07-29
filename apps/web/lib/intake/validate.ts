import type { Db } from "../store/ids.js";
import { assertInjectedHtml } from "../inject.js";
import { LIMITS, formatMb } from "../abuse/limits.js";
import { STORAGE_BUCKET, mockupObjectPath, mockupPrefix } from "../store/ids.js";
import { listObjectsRecursive, removeObjectsUnder } from "../store/storage-list.js";
import type { MockupManifest } from "./types.js";
import { isSafeMockupPath } from "./extract.js";

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

/** 한도 초과 — 형식 오류(400)와 달리 413으로 응답한다. */
export class MockupTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MockupTooLargeError";
  }
}

/** manifest 본문 형식만 검사(Storage 접근 없음). */
export function validateManifestShape(manifest: MockupManifest, projectId: string): void {
  if (!manifest || !Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new ManifestValidationError("manifest.entries가 비어 있습니다.");
  }
  if (manifest.entries.length > LIMITS.mockupMaxFileCount) {
    throw new MockupTooLargeError(
      `목업 파일 수가 한도(${LIMITS.mockupMaxFileCount}개)를 초과했습니다 — ${manifest.entries.length}개.`,
    );
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

/** HTML 다운로드 동시성 — 서버리스 메모리·소켓을 한꺼번에 물지 않게 나눠 받는다. */
const HTML_BATCH = 20;

/**
 * Storage에 올라간 주입본을 검증한다(D5·D6).
 * 서버는 파일을 만들지 않고, 클라이언트가 올린 결과만 확인한다.
 *
 * W8: 여기가 업로드 검증의 **신뢰 경계**다(technical-spec §7.4). 인테이크는 브라우저 unzip +
 * Storage 직업로드라 클라이언트 게이트는 UX용일 뿐이므로, 파일 수·총 바이트는 Storage에 실제로
 * 올라간 것으로 판정한다. 본문 다운로드는 HTML 엔트리에만 — 대용량 바이너리를 서버 메모리로
 * 끌어오지 않는다(zip bomb 방어와 같은 목적).
 */
export async function validateMockupManifest(
  db: Db,
  projectId: string,
  manifest: MockupManifest,
): Promise<void> {
  validateManifestShape(manifest, projectId);

  const prefix = mockupPrefix(projectId);
  const objects = await listObjectsRecursive(db, prefix);

  const totalBytes = objects.reduce((sum, o) => sum + o.size, 0);
  if (totalBytes > LIMITS.mockupMaxTotalBytes) {
    throw new MockupTooLargeError(
      `목업 총 크기가 한도(${formatMb(LIMITS.mockupMaxTotalBytes)})를 초과했습니다 — ${formatMb(totalBytes)}.`,
    );
  }
  if (objects.length > LIMITS.mockupMaxFileCount) {
    throw new MockupTooLargeError(
      `업로드된 오브젝트 수가 한도(${LIMITS.mockupMaxFileCount}개)를 초과했습니다 — ${objects.length}개.`,
    );
  }

  const uploaded = new Set(objects.map((o) => o.path.slice(prefix.length + 1)));
  for (const entry of manifest.entries) {
    if (!uploaded.has(entry)) {
      throw new ManifestValidationError(`Storage에 없는 엔트리: ${entry}`);
    }
  }

  const htmlEntries = manifest.entries.filter((e) => /\.html?$/i.test(e));
  if (!htmlEntries.includes(manifest.indexPath)) {
    throw new ManifestValidationError("index.html을 찾을 수 없습니다.");
  }

  for (let i = 0; i < htmlEntries.length; i += HTML_BATCH) {
    const batch = htmlEntries.slice(i, i + HTML_BATCH);
    await Promise.all(
      batch.map(async (entry) => {
        const { data, error } = await db.storage
          .from(STORAGE_BUCKET)
          .download(mockupObjectPath(projectId, entry));
        if (error || !data) {
          throw new ManifestValidationError(`Storage에 없는 엔트리: ${entry}`);
        }
        const html = new TextDecoder("utf-8", { fatal: false }).decode(
          new Uint8Array(await data.arrayBuffer()),
        );
        try {
          assertInjectedHtml(html, projectId);
        } catch {
          throw new ManifestValidationError(
            entry === manifest.indexPath
              ? "index.html에 SDK·base 주입이 올바르지 않습니다."
              : `${entry}에 SDK·base 주입이 올바르지 않습니다.`,
          );
        }
      }),
    );
  }
}

/** 검증 실패 시 부분 업로드 정리. */
export async function removeMockupPrefix(db: Db, projectId: string): Promise<void> {
  await removeObjectsUnder(db, mockupPrefix(projectId));
}
