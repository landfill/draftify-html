import type { Response } from "express";

/**
 * API 에러 응답 표준 (ID-10): `{ error: { code, message } }`.
 * S1은 4개로 시작. `BAD_GATEWAY`는 S2 프록시(경로 B)에서 오리진 실패·오리진 밖
 * 리다이렉트를 알리기 위해 추가 (킥오프 s2 §2.2 "502").
 */
export type ErrorCode = "INVALID_REQUEST" | "NOT_FOUND" | "TOO_LARGE" | "INTERNAL" | "BAD_GATEWAY";

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  TOO_LARGE: 413,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
};

export function sendError(res: Response, code: ErrorCode, message: string): void {
  res.status(STATUS[code]).json({ error: { code, message } });
}
