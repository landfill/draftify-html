import type { Db } from "../store/ids.js";
import { STORAGE_BUCKET, mockupObjectPath } from "../store/ids.js";
import { readSpec } from "../store/projectStore.js";
import { contentTypeForPath, isSpaFallbackCandidate } from "./mime.js";
import {
  directoryIndexPath,
  isValidProjectId,
  resolveMockupRelativePath,
} from "./paths.js";

const INDEX_HTML = "index.html";

async function downloadObject(
  db: Db,
  projectId: string,
  relativePath: string,
): Promise<Uint8Array | null> {
  const { data, error } = await db.storage
    .from(STORAGE_BUCKET)
    .download(mockupObjectPath(projectId, relativePath));
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

function storageResponse(bytes: Uint8Array, relativePath: string): Response {
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: { "Content-Type": contentTypeForPath(relativePath) },
  });
}

/**
 * `/m/{id}/*` 목업 서빙 — 소유권은 readSpec(RLS) + Storage RLS.
 * HTML은 인제스트 주입본을 그대로 스트림(D6·per-request 변조 없음).
 */
export async function serveMockupFile(
  db: Db,
  projectId: string,
  pathSegments: string[] | undefined,
): Promise<Response> {
  if (!isValidProjectId(projectId)) {
    return new Response("잘못된 프로젝트 ID", { status: 400 });
  }

  const spec = await readSpec(db, projectId);
  if (!spec) {
    return new Response("프로젝트를 찾을 수 없습니다.", { status: 404 });
  }

  if (spec.mockupSource.type !== "upload") {
    return new Response("이 프로젝트는 정적 목업 서빙을 지원하지 않습니다.", { status: 404 });
  }

  const relativePath = resolveMockupRelativePath(pathSegments);
  if (!relativePath) {
    return new Response("잘못된 경로입니다.", { status: 400 });
  }

  const candidates: string[] = [relativePath];
  const withIndex = directoryIndexPath(relativePath);
  if (withIndex !== relativePath) candidates.push(withIndex);

  for (const candidate of candidates) {
    const bytes = await downloadObject(db, projectId, candidate);
    if (bytes) return storageResponse(bytes, candidate);
  }

  // SPA history fallback (FR-ONB-04)
  if (isSpaFallbackCandidate(relativePath)) {
    const indexBytes = await downloadObject(db, projectId, INDEX_HTML);
    if (indexBytes) return storageResponse(indexBytes, INDEX_HTML);
  }

  return new Response("파일을 찾을 수 없습니다.", { status: 404 });
}
