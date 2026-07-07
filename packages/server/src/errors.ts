import type { Response } from "express";

/** API 에러 응답 표준 (ID-10): `{ error: { code, message } }`. 코드 4개로 시작. */
export type ErrorCode = "INVALID_REQUEST" | "NOT_FOUND" | "TOO_LARGE" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  TOO_LARGE: 413,
  INTERNAL: 500,
};

export function sendError(res: Response, code: ErrorCode, message: string): void {
  res.status(STATUS[code]).json({ error: { code, message } });
}
