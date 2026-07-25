import type { SpecProject } from "@mockspec/shared";
import type { Json } from "../supabase/database.types.js";
import {
  type Db,
  STORAGE_BUCKET,
  makeProjectId,
  makeAssetKey,
  isAssetKey,
  assetObjectPath,
  projectPrefix,
} from "./ids.js";
import { removeObjectsUnder } from "./storage-list.js";

/**
 * projectStore Supabase 어댑터 — 기존 파일 기반(packages/server/src/store/projectStore.ts)의
 * 인터페이스를 owner 스코프로 이식. 모든 함수는 요청 스코프 클라이언트 `db`를 받고, RLS가
 * owner_id = auth.uid() 로 격리한다(어댑터는 소유권을 직접 확인하지 않는다 — DB가 강제).
 *
 * spec(JSONB)이 유일한 원천. name·updated_at 컬럼은 DB 트리거가 spec에서 파생한다.
 */

type SourceInfo =
  | { type: "upload"; originalFilename: string }
  | { type: "snippet" }; // proxy(경로 B)는 공개판 제외(D2) — 인테이크에서 받지 않는다.

function buildSpec(name: string, source: SourceInfo, ownerLabel?: string): SpecProject {
  const id = makeProjectId();
  const now = new Date().toISOString();
  const mockupSource: SpecProject["mockupSource"] =
    source.type === "upload"
      ? { type: "upload", originalFilename: source.originalFilename, uploadedAt: now }
      : { type: "snippet", registeredAt: now };
  return {
    version: 1,
    id,
    name,
    ...(ownerLabel ? { ownerLabel } : {}),
    createdAt: now,
    updatedAt: now,
    mockupSource,
    sceneCodeSeq: 1,
    scenes: [],
    annotations: [],
  };
}

/** 새 프로젝트 생성. owner_id는 DB 기본값 auth.uid()가 채운다. */
export async function createProject(
  db: Db,
  name: string,
  source: SourceInfo,
  ownerLabel?: string,
): Promise<SpecProject> {
  const spec = buildSpec(name, source, ownerLabel);
  const { error } = await db
    .from("projects")
    .insert({ id: spec.id, name: spec.name, spec: spec as unknown as Json });
  if (error) throw new Error(`createProject failed: ${error.message}`);
  return spec;
}

export async function readSpec(db: Db, id: string): Promise<SpecProject | null> {
  const { data, error } = await db.from("projects").select("spec").eq("id", id).maybeSingle();
  if (error) throw new Error(`readSpec failed: ${error.message}`);
  return data ? (data.spec as unknown as SpecProject) : null;
}

/** 소유자의 프로젝트 목록 (RLS가 타 소유자를 걸러낸다). 최신 저장 순. */
export async function listProjects(db: Db): Promise<SpecProject[]> {
  const { data, error } = await db
    .from("projects")
    .select("spec")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`listProjects failed: ${error.message}`);
  return (data ?? []).map((r) => r.spec as unknown as SpecProject);
}

/** 장면들이 참조 중인 스냅샷 asset 키 (원본 + 마스킹본). */
function referencedAssets(spec: SpecProject): Set<string> {
  const keys = new Set<string>();
  for (const scene of spec.scenes) {
    if (scene.snapshotAsset) keys.add(scene.snapshotAsset);
    if (scene.maskedSnapshotAsset) keys.add(scene.maskedSnapshotAsset);
  }
  return keys;
}

/**
 * 문서 전체 교체(PUT). updatedAt을 서버 시각으로 갱신하고, 더 이상 참조되지 않는 asset을
 * Storage에서 즉시 삭제한다(ID-11). 검증(version·id)은 라우트 책임.
 */
export async function replaceSpec(
  db: Db,
  prev: SpecProject,
  next: SpecProject,
): Promise<SpecProject> {
  const saved: SpecProject = { ...next, updatedAt: new Date().toISOString() };
  const { error } = await db
    .from("projects")
    .update({ spec: saved as unknown as Json })
    .eq("id", saved.id);
  if (error) throw new Error(`replaceSpec failed: ${error.message}`);

  const stillUsed = referencedAssets(saved);
  const orphaned = [...referencedAssets(prev)].filter((k) => !stillUsed.has(k));
  if (orphaned.length > 0) {
    await db.storage
      .from(STORAGE_BUCKET)
      .remove(orphaned.map((key) => assetObjectPath(next.id, key)));
  }
  return saved;
}

/** 프로젝트 삭제 — 행(토큰·이력은 FK cascade) + Storage projects/{id}/ 전체. */
export async function deleteProject(db: Db, id: string): Promise<void> {
  // Storage는 FK cascade 대상이 아니므로 오브젝트를 먼저 나열해 삭제.
  // 목업은 중첩 디렉토리(js/·assets/)가 흔하므로 **재귀**로 지운다 — 한 단계만 보면 오브젝트가
  // 남아 버킷 용량을 계속 먹는다(W8 쿼터 정합성).
  await removeObjectsUnder(db, projectPrefix(id));
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw new Error(`deleteProject failed: ${error.message}`);
}

export async function saveAsset(db: Db, id: string, data: Uint8Array | Blob): Promise<string> {
  const key = makeAssetKey();
  const { error } = await db.storage
    .from(STORAGE_BUCKET)
    .upload(assetObjectPath(id, key), data, { upsert: false });
  if (error) throw new Error(`saveAsset failed: ${error.message}`);
  return key;
}

export async function readAsset(db: Db, id: string, key: string): Promise<Uint8Array | null> {
  if (!isAssetKey(key)) return null;
  const { data, error } = await db.storage.from(STORAGE_BUCKET).download(assetObjectPath(id, key));
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteAsset(db: Db, id: string, key: string): Promise<void> {
  if (!isAssetKey(key)) return;
  await db.storage.from(STORAGE_BUCKET).remove([assetObjectPath(id, key)]);
}
