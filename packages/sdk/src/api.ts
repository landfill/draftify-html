import { PENDING_QUEUE_KEY_PREFIX, RESERVED_PATH_PREFIX, type SpecProject } from "@mockspec/shared";

/**
 * Spec API 클라이언트.
 * SDK는 목업 서브도메인의 same-origin API를 상대 경로로만 호출한다 (ID-01/03, CORS 없음).
 */

const apiBase = `${RESERVED_PATH_PREFIX}/api`;

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    if (body.error?.message) return body.error.message;
  } catch {
    /* 본문이 JSON이 아니면 fallback */
  }
  return `${fallback} (HTTP ${res.status})`;
}

function pendingKey(projectId: string): string {
  return `${PENDING_QUEUE_KEY_PREFIX}${projectId}`;
}

export function readPendingProject(projectId: string): SpecProject | null {
  const raw = localStorage.getItem(pendingKey(projectId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SpecProject>;
    if (parsed.version === 1 && parsed.id === projectId) return parsed as SpecProject;
  } catch {
    /* 깨진 큐는 아래에서 폐기 */
  }
  localStorage.removeItem(pendingKey(projectId));
  return null;
}

export function writePendingProject(project: SpecProject): void {
  localStorage.setItem(pendingKey(project.id), JSON.stringify(project));
}

export function clearPendingProject(projectId: string): void {
  localStorage.removeItem(pendingKey(projectId));
}

export async function fetchProject(projectId: string): Promise<SpecProject> {
  const res = await fetch(`${apiBase}/projects/${projectId}`);
  if (!res.ok) {
    throw new Error(await errorMessage(res, "프로젝트 불러오기 실패"));
  }
  return (await res.json()) as SpecProject;
}

export async function putProject(project: SpecProject): Promise<SpecProject> {
  const res = await fetch(`${apiBase}/projects/${project.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "프로젝트 저장 실패"));
  }
  return (await res.json()) as SpecProject;
}

/**
 * 저장 실패 시 최신 SpecProject 1개만 localStorage에 남긴다 (ID-05/technical-spec §6.2).
 * 실패 원인은 네트워크·HTTP 모두 동일하게 "오프라인 큐"로 취급한다.
 */
export async function saveProjectWithQueue(project: SpecProject): Promise<
  | { queued: false; project: SpecProject }
  | { queued: true; project: SpecProject; error: Error }
> {
  try {
    const saved = await putProject(project);
    clearPendingProject(project.id);
    return { queued: false, project: saved };
  } catch (err) {
    writePendingProject(project);
    const error = err instanceof Error ? err : new Error("프로젝트 저장 실패");
    return { queued: true, project, error };
  }
}

export async function flushPendingProject(projectId: string): Promise<SpecProject | null> {
  const pending = readPendingProject(projectId);
  if (!pending) return null;
  const saved = await putProject(pending);
  clearPendingProject(projectId);
  return saved;
}

/**
 * 동결 HTML을 asset store에 업로드하고 asset 키를 반환한다.
 * (POST /__mockspec/api/projects/:id/assets, field: snapshot — technical-spec §6)
 */
export async function uploadSnapshot(projectId: string, html: string): Promise<string> {
  const form = new FormData();
  form.append("snapshot", new Blob([html], { type: "text/html" }), `${projectId}.html`);

  const res = await fetch(`${apiBase}/projects/${projectId}/assets`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res, "스냅샷 업로드 실패"));
  }
  const body = (await res.json()) as { assetKey: string };
  return body.assetKey;
}
