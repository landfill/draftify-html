/**
 * Express 서버 진입점: 호스팅+SDK 주입, Spec API, Export. — technical-spec §1.3, §3, §6
 * T1은 스캐폴딩만. 실제 라우팅·저장은 T2·T3에서 구현.
 *
 * 오리진 하드코딩 금지 (ID-01): 포트는 env로만 받는다.
 */
import { WORKING_NAME, type SpecProject } from "@mockspec/shared";

/** 리스닝 포트. 오리진은 어디에도 하드코딩하지 않는다. */
export const PORT = Number(process.env.PORT ?? 4000);

/** 빈 프로젝트 뼈대 생성 — 실제 생성 로직(id 발급·저장)은 T3. */
export function emptyProject(id: string, name: string, filename: string): SpecProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    mockupSource: { type: "upload", originalFilename: filename, uploadedAt: now },
    sceneCodeSeq: 1,
    scenes: [],
    annotations: [],
  };
}

export function serviceName(): string {
  return WORKING_NAME;
}
