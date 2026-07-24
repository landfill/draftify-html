import type { Db } from "../store/ids.js";
import { STORAGE_BUCKET, mockupObjectPath } from "../store/ids.js";
import type { MockupManifest } from "./types.js";
import { prepareZipIntake, type IntakePrepareResult } from "./process.js";

export interface UploadProgress {
  done: number;
  total: number;
}

/**
 * 브라우저 인테이크 오케스트레이션: unzip → 주입 → Storage 직업로드.
 * complete API 호출은 호출자(콘솔 UI, W7)가 manifest로 수행한다.
 */
export async function uploadProcessedMockup(
  db: Db,
  projectId: string,
  prepared: IntakePrepareResult,
  onProgress?: (p: UploadProgress) => void,
): Promise<MockupManifest> {
  const { files, manifest } = prepared;
  let done = 0;
  const total = files.length;

  for (const file of files) {
    const { error } = await db.storage
      .from(STORAGE_BUCKET)
      .upload(mockupObjectPath(projectId, file.path), file.data, {
        upsert: true,
        contentType: file.contentType,
      });
    if (error) throw new Error(`Storage upload failed (${file.path}): ${error.message}`);
    done++;
    onProgress?.({ done, total });
  }

  return manifest;
}

/** zip File/Blob 전체 흐름 — prepare + upload. */
export async function uploadMockupZip(
  db: Db,
  projectId: string,
  zip: Blob,
  onProgress?: (p: UploadProgress) => void,
): Promise<{ manifest: MockupManifest; extract: IntakePrepareResult["extract"] }> {
  const buffer = new Uint8Array(await zip.arrayBuffer());
  const prepared = await prepareZipIntake(buffer, projectId);
  const manifest = await uploadProcessedMockup(db, projectId, prepared, onProgress);
  return { manifest, extract: prepared.extract };
}

/** complete API에 통보하고 mockup URL을 받는다. */
export async function completeMockupIntake(
  projectId: string,
  manifest: MockupManifest,
): Promise<{ mockupUrl: string }> {
  const res = await fetch(`/api/projects/${projectId}/mockup/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });
  const body = (await res.json()) as { mockupUrl?: string; error?: { message: string } };
  if (!res.ok) {
    throw new Error(body.error?.message ?? `complete failed (${res.status})`);
  }
  return { mockupUrl: body.mockupUrl! };
}
