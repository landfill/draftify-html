import { RESERVED_PATH_PREFIX } from "@mockspec/shared";

/**
 * Spec API 클라이언트 — T6분(동결 스냅샷 업로드).
 * SDK는 목업 서브도메인의 same-origin API를 상대 경로로만 호출한다 (ID-01/03, CORS 없음).
 * 전체 spec 저장(PUT)·오프라인 큐는 T7에서 이 모듈에 얹는다.
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
