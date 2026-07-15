import { PENDING_QUEUE_KEY_PREFIX, type SpecProject } from "@mockspec/shared";
import { request, type TransportResponse } from "./transport.js";

/**
 * Spec API 클라이언트.
 * 경로 A·B: 목업 서브도메인의 same-origin API를 상대 경로로 호출 (ID-01/03, CORS 없음).
 * 경로 D: transport가 확장 브리지로 교체된다 (transport.ts) — 호출부는 동일.
 */

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

function errorMessage(res: TransportResponse, fallback: string): string {
  try {
    const body = JSON.parse(res.bodyText) as ApiErrorBody;
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
  const res = await request({ path: `/projects/${projectId}`, method: "GET" });
  if (!res.ok) {
    throw new Error(errorMessage(res, "프로젝트 불러오기 실패"));
  }
  return JSON.parse(res.bodyText) as SpecProject;
}

/** Content-Disposition에서 파일명 추출 — 한글은 filename*(RFC 5987) 우선, ASCII fallback. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch { /* 손상 시 ASCII fallback */ }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : null;
}

export type ExportResult =
  /** 경로 D — 확장(background)이 chrome.downloads로 직접 저장. 본문은 브리지를 타지 않는다 */
  | { nativeDownload: true; warning: null }
  | {
      nativeDownload: false;
      blob: Blob;
      filename: string;
      /** 50MB 초과 등 서버 경고 헤더 (X-Mockspec-Warning). 없으면 null. */
      warning: string | null;
    };

/** background가 직접 다운로드했음을 알리는 브리지 합성 헤더 (서버 헤더 아님). */
export const NATIVE_DOWNLOAD_HEADER = "x-mockspec-native-download";

/** 산출물 HTML 다운로드 — 편집 패널 [내보내기] 버튼 (킥오프 §11 6차 개정). */
export async function exportProjectHtml(projectId: string): Promise<ExportResult> {
  const res = await request({ path: `/projects/${projectId}/export`, method: "POST", download: true });
  if (!res.ok) {
    throw new Error(errorMessage(res, "내보내기 실패"));
  }
  if (res.headers[NATIVE_DOWNLOAD_HEADER]) {
    return { nativeDownload: true, warning: null };
  }
  return {
    nativeDownload: false,
    blob: new Blob([res.bodyText], { type: "text/html" }),
    filename: filenameFromDisposition(res.headers["content-disposition"] ?? null) ?? `${projectId}.html`,
    warning: res.headers["x-mockspec-warning"] ?? null,
  };
}

export async function putProject(project: SpecProject): Promise<SpecProject> {
  const res = await request({
    path: `/projects/${project.id}`,
    method: "PUT",
    body: JSON.stringify(project),
    bodyType: "json",
  });
  if (!res.ok) {
    throw new Error(errorMessage(res, "프로젝트 저장 실패"));
  }
  return JSON.parse(res.bodyText) as SpecProject;
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
 * 캡처 HTML을 asset store에 업로드하고 asset 키를 반환한다.
 * (POST /__mockspec/api/projects/:id/assets, field: snapshot — technical-spec §6)
 */
export async function uploadSnapshot(projectId: string, html: string): Promise<string> {
  const res = await request({
    path: `/projects/${projectId}/assets`,
    method: "POST",
    body: html,
    bodyType: "snapshot",
  });
  if (!res.ok) {
    throw new Error(errorMessage(res, "스냅샷 업로드 실패"));
  }
  const body = JSON.parse(res.bodyText) as { assetKey: string };
  return body.assetKey;
}
