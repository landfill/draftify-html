import fs from "node:fs/promises";
import type { SpecProject } from "@mockspec/shared";
import { makeProjectId } from "../ids.js";
import { projectsRoot, projectDir, specFile, mockupDir, assetsDir } from "./paths.js";

/**
 * 파일 기반 JSON 저장소. 프로젝트당 spec.json 1파일 + mockup/ + assets/. (technical-spec §6.1)
 * S1은 단일 편집자 전제라 잠금·병합 없음. PUT은 문서 전체 교체(T3).
 */

async function writeSpec(spec: SpecProject): Promise<void> {
  await fs.mkdir(projectDir(spec.id), { recursive: true });
  await fs.writeFile(specFile(spec.id), JSON.stringify(spec, null, 2), "utf8");
}

/** 업로드된 목업으로 새 프로젝트를 만든다. mockup/·assets/ 디렉토리와 spec.json 생성. */
export async function createProject(name: string, originalFilename: string): Promise<SpecProject> {
  const id = makeProjectId();
  const now = new Date().toISOString();
  const spec: SpecProject = {
    version: 1,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    mockupSource: { type: "upload", originalFilename, uploadedAt: now },
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
