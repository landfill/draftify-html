/** Authorization: Bearer {token} 파싱. */
export function parseBearerToken(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return m?.[1] ?? null;
}

/** 경로 D API — 세션 없이 Bearer만으로 미들웨어 통과 허용(W6). */
export function hasBearerAuth(req: Request): boolean {
  return parseBearerToken(req) !== null;
}
