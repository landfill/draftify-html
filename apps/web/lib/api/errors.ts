import { NextResponse } from "next/server";

/** packages/server/src/errors.ts 와 동일 코드·본문 형태(ID-10). */
export type ErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "TOO_LARGE"
  | "INTERNAL"
  | "BAD_GATEWAY";

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TOO_LARGE: 413,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
};

export function jsonError(code: ErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] });
}
