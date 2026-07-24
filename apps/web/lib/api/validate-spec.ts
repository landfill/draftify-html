import type { SpecProject } from "@mockspec/shared";

/** PUT /api/projects/{id} 본문 검증 — version·id·mockupSource 불변, 배열 구조. */
export function validatePutSpec(
  body: unknown,
  projectId: string,
  prev: SpecProject,
): { ok: true; spec: SpecProject } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "JSON 본문이 필요합니다." };
  }

  const candidate = body as Partial<SpecProject>;
  if (candidate.version !== 1 || candidate.id !== projectId) {
    return { ok: false, message: "version(=1)·id가 경로와 일치해야 합니다." };
  }

  if (!Array.isArray(candidate.scenes) || !Array.isArray(candidate.annotations)) {
    return { ok: false, message: "scenes·annotations 배열이 필요합니다." };
  }

  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    return { ok: false, message: "name이 필요합니다." };
  }

  if (typeof candidate.sceneCodeSeq !== "number" || !Number.isFinite(candidate.sceneCodeSeq)) {
    return { ok: false, message: "sceneCodeSeq가 올바르지 않습니다." };
  }

  // mockupSource는 서버 소유 메타 — 클라이언트가 바꿀 수 없다.
  const spec: SpecProject = {
    ...(candidate as SpecProject),
    mockupSource: prev.mockupSource,
    createdAt: prev.createdAt,
  };

  return { ok: true, spec };
}
