import fs from "node:fs/promises";
import path from "node:path";
import type { SpecProject } from "@mockspec/shared";
import { makeProjectId } from "../ids.js";
import { customAlphabet } from "nanoid";
import { projectsRoot, projectDir, specFile, mockupDir, assetsDir } from "./paths.js";

/**
 * 파일 기반 JSON 저장소. 프로젝트당 spec.json 1파일 + mockup/ + assets/. (technical-spec §6.1)
 * S1은 단일 편집자 전제라 잠금·병합 없음. PUT은 문서 전체 교체.
 */

const assetNano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

async function writeSpec(spec: SpecProject): Promise<void> {
  await fs.mkdir(projectDir(spec.id), { recursive: true });
  await fs.writeFile(specFile(spec.id), JSON.stringify(spec, null, 2), "utf8");
}

/** 업로드된 목업 또는 등록된 URL로 새 프로젝트를 만든다. mockup/·assets/ 디렉토리와 spec.json 생성. */
export async function createProject(
  name: string,
  sourceInfo: { type: "upload"; originalFilename: string } | { type: "proxy"; originUrl: string }
): Promise<SpecProject> {
  const id = makeProjectId();
  const now = new Date().toISOString();
  const spec: SpecProject = {
    version: 1,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    mockupSource: sourceInfo.type === "upload"
      ? { type: "upload", originalFilename: sourceInfo.originalFilename, uploadedAt: now }
      : { type: "proxy", originUrl: sourceInfo.originUrl, registeredAt: now },
    sceneCodeSeq: 1,
    scenes: [],
    annotations: [],
  };
  await fs.mkdir(mockupDir(id), { recursive: true });
  await fs.mkdir(assetsDir(id), { recursive: true });
  await writeSpec(spec);
  return spec;
}

export async function readSpec(id: string): Promise<SpecProject | null> {
  try {
    const raw = await fs.readFile(specFile(id), "utf8");
    return JSON.parse(raw) as SpecProject;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function listProjects(): Promise<SpecProject[]> {
  let ids: string[];
  try {
    ids = await fs.readdir(projectsRoot());
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const specs = await Promise.all(ids.map((id) => readSpec(id)));
  return specs
    .filter((s): s is SpecProject => s !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 장면들이 참조 중인 스냅샷 asset 키 집합 (원본 + 마스킹본). */
function referencedAssets(spec: SpecProject): Set<string> {
  const keys = new Set<string>();
  for (const scene of spec.scenes) {
    if (scene.snapshotAsset) keys.add(scene.snapshotAsset);
    if (scene.maskedSnapshotAsset) keys.add(scene.maskedSnapshotAsset);
  }
  return keys;
}

/**
 * 문서 전체 교체(PUT). 저장 시 updatedAt을 서버 시각으로 갱신하고,
 * 이전 spec 대비 더 이상 참조되지 않는 asset을 즉시 삭제한다 (ID-11 — 별도 GC 없이
 * 재동결·장면 삭제 두 규칙을 한 곳에서 강제). 검증(version·id)은 라우트 책임.
 */
export async function replaceSpec(prev: SpecProject, next: SpecProject): Promise<SpecProject> {
  const saved: SpecProject = { ...next, updatedAt: new Date().toISOString() };
  await writeSpec(saved);

  const stillUsed = referencedAssets(saved);
  const orphaned = [...referencedAssets(prev)].filter((k) => !stillUsed.has(k));
  await Promise.all(orphaned.map((key) => deleteAsset(next.id, key).catch(() => undefined)));

  return saved;
}

export async function deleteProject(id: string): Promise<void> {
  await fs.rm(projectDir(id), { recursive: true, force: true });
}

/** asset 키를 디렉토리 이탈 없이 파일 경로로 변환. 형식 위반이면 null. */
function assetPath(id: string, key: string): string | null {
  if (!/^asset_[0-9a-z]+$/.test(key)) return null;
  const p = path.join(assetsDir(id), key);
  const root = assetsDir(id);
  return p === root || p.startsWith(root + path.sep) ? p : null;
}

export async function saveAsset(id: string, data: Buffer): Promise<string> {
  const key = `asset_${assetNano()}`;
  await fs.mkdir(assetsDir(id), { recursive: true });
  await fs.writeFile(assetPath(id, key)!, data);
  return key;
}

export async function readAsset(id: string, key: string): Promise<Buffer | null> {
  const p = assetPath(id, key);
  if (!p) return null;
  try {
    return await fs.readFile(p);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function deleteAsset(id: string, key: string): Promise<void> {
  const p = assetPath(id, key);
  if (!p) return;
  await fs.rm(p, { force: true });
}
