import { NextResponse } from "next/server";

/**
 * packages/server/src/errors.ts 와 동일 본문 형태(ID-10).
 * 공개판 전용 2종 추가(W8, 킥오프 §7.5): 쿼터 소진은 `QUOTA_EXCEEDED`(403 — 재시도해도 안 되고
 * 사용자가 정리해야 풀린다), 레이트 초과는 `TOO_MANY_REQUESTS`(429 — 기다리면 풀린다).
 */
export type ErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "TOO_LARGE"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL"
  | "BAD_GATEWAY";

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  QUOTA_EXCEEDED: 403,
  TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
  BAD_GATEWAY: 502,
};

export function jsonError(code: ErrorCode, message: string, headers?: HeadersInit) {
  return NextResponse.json(
    { error: { code, message } },
    { status: STATUS[code], ...(headers ? { headers } : {}) },
  );
}

/** 레이트리밋 거부 — Retry-After(초)를 함께 준다. */
export function rateLimitedError(retryAfterSeconds: number) {
  return jsonError(
    "TOO_MANY_REQUESTS",
    `요청이 너무 잦습니다. ${retryAfterSeconds}초 후 다시 시도해 주세요.`,
    { "Retry-After": String(retryAfterSeconds) },
  );
}
