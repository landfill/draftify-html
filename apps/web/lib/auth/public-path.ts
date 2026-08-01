/** 인증 없이 접근 가능한 경로(정확 일치 또는 `base/` 하위). `/guidexyz` 오탐 방지. */
export const PUBLIC_PATH_BASES = [
  "/login",
  "/auth",
  "/guide",
  "/faq",
  "/sample",
  "/download",
] as const;

export function isPublicPath(pathname: string): boolean {
  // `/`는 비로그인 랜딩이지만 `/m/*`·콘솔 API까지 함께 열리면 안 된다 (이슈 #85).
  return pathname === "/" || PUBLIC_PATH_BASES.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`),
  );
}

/** 인증이 필요한 API 경로(브리지 포함). */
export function isProtectedApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname.startsWith("/__mockspec/api/");
}
