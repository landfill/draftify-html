/**
 * 인증 콜백의 `next` 파라미터 정규화 — **오픈 리다이렉트 방지**.
 *
 * `new URL(next, origin)`은 `next`가 절대 URL이면 origin을 무시한다. 그래서
 * `/auth/callback?next=https://attacker.example`이 그대로 외부로 나가고, 신뢰받는 서비스
 * 도메인이 피싱 도약대가 된다(코드 없이도 성립 — 리다이렉트가 인증보다 앞에 있다).
 *
 * 같은 오리진의 **경로**만 허용한다. `//evil.com`은 프로토콜 상대 URL이라 외부로 나가므로
 * 함께 막는다(`/`로 시작한다고 안전한 것이 아니다).
 */
export function safeNextPath(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  // 백슬래시를 슬래시로 해석하는 브라우저가 있어 `/\evil.com`도 외부로 샐 수 있다.
  if (raw.startsWith("/\\")) return "/";
  return raw;
}
