/**
 * SSRF 가드 (경로 B 프록시의 전제 — technical-spec §7.2, 킥오프 s2 §4.1).
 *
 * 경로 B는 "사용자가 준 URL로 서버가 요청을 보내는" 구조라 전형적 SSRF 표면이다.
 * 방어는 세 겹:
 *   1) allowlist (deny-by-default) — 미설정이면 URL 등록 자체를 거부
 *   2) hard-deny IP — allowlist와 무관하게 차단 (메타데이터·루프백·링크로컬·ULA)
 *   3) IP 고정 — DNS resolve 결과를 검증한 뒤 그 IP로만 연결 (검증↔연결 사이 rebinding 차단)
 *
 * 이 모듈은 transport(fetch/http)에 의존하지 않는다. IP 고정은 Node `dns.lookup` 호환
 * 훅(`createGuardedLookup`)으로 제공하며, 실제 연결 계층(T13)이 이 훅을 꽂아 쓴다.
 * 사설 대역(10/8, 172.16/12, 192.168/16)은 hard-deny하지 않는다 — 사내 스테이징이 그
 * 대역이며 allowlist 명시가 곧 허용 의사다.
 */

import dns from "node:dns/promises";
import net, { type LookupFunction } from "node:net";

/** allowlist를 담는 env 이름. 콤마 구분 호스트 패턴. */
export const ALLOWLIST_ENV = "MOCKSPEC_PROXY_ALLOWLIST";

/**
 * dev/test 전용 루프백 허용 스위치. 참이면 127/8·::1·unspecified를 hard-deny에서 제외한다.
 * 클라우드 메타데이터(169.254)·ULA·링크로컬 차단은 **영향받지 않는다**.
 * 용도: 로컬 개발 서버·테스트 fixture가 127.0.0.1에 뜨므로 프록시 경로를 검증하려면 필요.
 * 운영 배포에서는 절대 켜지 않는다 (루프백=서비스 자신, SSRF의 핵심 표적).
 */
export const ALLOW_LOOPBACK_ENV = "MOCKSPEC_PROXY_ALLOW_LOOPBACK";

/** ALLOW_LOOPBACK_ENV가 켜졌는지. */
export function isLoopbackAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return /^(1|true|yes)$/i.test(env[ALLOW_LOOPBACK_ENV] ?? "");
}

export type SsrfReason =
  | "PROTOCOL" // http/https가 아님
  | "NOT_ALLOWLISTED" // allowlist 미매칭(빈 allowlist 포함)
  | "BLOCKED_ADDRESS" // resolve 결과가 hard-deny IP
  | "UNRESOLVABLE"; // DNS resolve 실패 또는 주소 0개

export class SsrfError extends Error {
  constructor(
    readonly reason: SsrfReason,
    message: string,
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

/** dns.lookup(all:true) 한 항목과 동일 형태. */
export interface ResolvedAddress {
  address: string;
  family: number; // 4 | 6
}

/** 테스트·주입용 리졸버. 기본은 실제 DNS. */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: Resolver = async (hostname) => {
  const addrs = await dns.lookup(hostname, { all: true });
  return addrs.map((a) => ({ address: a.address, family: a.family }));
};

// ── allowlist ──────────────────────────────────────────────────────────────

/** env에서 allowlist 패턴을 읽어 정규화(소문자·trim·빈 값 제거)한다. */
export function getAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env[ALLOWLIST_ENV];
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0);
}

/**
 * hostname이 allowlist에 매칭되는지. 지원 형태 두 가지:
 *   - 정확 일치: `mockup.team-a.internal`
 *   - 서브도메인 와일드카드: `*.staging.example.com` (앞에 1단계 이상 라벨 필요)
 * 빈 allowlist는 항상 false (deny-by-default).
 */
export function isAllowlisted(hostname: string, patterns: string[]): boolean {
  const host = hostname.toLowerCase();
  for (const pattern of patterns) {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".staging.example.com"
      if (host.length > suffix.length && host.endsWith(suffix)) return true;
    } else if (host === pattern) {
      return true;
    }
  }
  return false;
}

// ── IP 분류 (hard-deny) ──────────────────────────────────────────────────────

/** IPv4-mapped IPv6(::ffff:a.b.c.d)면 내장 v4를 꺼낸다. 아니면 원본 반환. */
function unwrapMappedV4(ip: string): string {
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return m ? m[1]! : ip;
}

function isBlockedV4(ip: string, allowLoopback: boolean): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // 파싱 불가한 주소는 안전하게 차단
  }
  const [a, b] = parts as [number, number, number, number];
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 링크로컬 + 클라우드 메타데이터 (항상 차단)
  if (allowLoopback) return false; // dev/test: 루프백·unspecified 허용
  if (a === 0) return true; // 0.0.0.0/8 unspecified/this-network
  if (a === 127) return true; // 127.0.0.0/8 loopback
  return false; // 사설 대역(10/172.16/192.168)은 여기서 막지 않음
}

function isBlockedV6(ip: string, allowLoopback: boolean): boolean {
  const lower = ip.toLowerCase().split("%")[0]!; // zone id 제거
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // fe80::/10 링크로컬 (항상 차단)
  }
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA(fd00::/8 포함, 항상 차단)
  if (allowLoopback) return false; // dev/test: 루프백·unspecified 허용
  if (lower === "::1") return true; // loopback
  if (lower === "::" || lower === "::0") return true; // unspecified
  return false;
}

/**
 * hard-deny 대상 IP인가. allowlist와 무관하게 차단해야 하는 주소.
 * `allowLoopback`은 dev/test 전용(§ALLOW_LOOPBACK_ENV) — 루프백·unspecified만 완화하고
 * 메타데이터·ULA·링크로컬 차단은 유지한다.
 */
export function isBlockedAddress(ip: string, opts: { allowLoopback?: boolean } = {}): boolean {
  const allowLoopback = opts.allowLoopback ?? false;
  const unwrapped = unwrapMappedV4(ip);
  if (net.isIPv4(unwrapped)) return isBlockedV4(unwrapped, allowLoopback);
  if (net.isIPv6(unwrapped)) return isBlockedV6(unwrapped, allowLoopback);
  return true; // IP 형식이 아니면 차단
}

// ── 오리진 검증 ──────────────────────────────────────────────────────────────

export interface ValidatedOrigin {
  url: URL;
  hostname: string;
  addresses: ResolvedAddress[];
}

/**
 * URL 문자열을 프로토콜·allowlist·DNS·IP까지 전부 검증한다.
 * 등록 시점(콘솔 폼)과 프록시 요청 시점 양쪽에서 호출한다 (킥오프 s2 §4.1 검증 시점 ①·②).
 * 실패는 SsrfError(reason)로 던진다.
 */
export async function validateOrigin(
  rawUrl: string,
  opts: { resolver?: Resolver; env?: NodeJS.ProcessEnv; allowLoopback?: boolean } = {},
): Promise<ValidatedOrigin> {
  const resolver = opts.resolver ?? defaultResolver;
  const allowLoopback = opts.allowLoopback ?? isLoopbackAllowed(opts.env);

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("PROTOCOL", "URL 형식이 올바르지 않습니다");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("PROTOCOL", `지원하지 않는 프로토콜입니다: ${url.protocol}`);
  }

  const allowlist = getAllowlist(opts.env);
  if (!isAllowlisted(url.hostname, allowlist)) {
    throw new SsrfError("NOT_ALLOWLISTED", "허용되지 않은 오리진입니다");
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(url.hostname);
  } catch {
    throw new SsrfError("UNRESOLVABLE", "오리진 호스트를 해석할 수 없습니다");
  }
  if (addresses.length === 0) {
    throw new SsrfError("UNRESOLVABLE", "오리진 호스트가 IP로 해석되지 않았습니다");
  }
  // resolve된 주소 중 하나라도 hard-deny면 전체 거부 (split-horizon·다중 A레코드 우회 차단)
  for (const a of addresses) {
    if (isBlockedAddress(a.address, { allowLoopback })) {
      throw new SsrfError("BLOCKED_ADDRESS", `차단된 IP로 해석됩니다: ${a.address}`);
    }
  }

  return { url, hostname: url.hostname, addresses };
}

// ── IP 고정 연결 훅 ───────────────────────────────────────────────────────────

/**
 * `dns.lookup` 호환 훅. 연결 계층(node:http/https의 `lookup` 옵션)에 꽂으면 매 연결마다
 * resolve→검증을 다시 수행하고 hard-deny IP면 연결을 실패시킨다. 이것이 "resolve된 IP로
 * 고정"(§4.1)의 구현 — 검증한 바로 그 주소로만 소켓이 열린다.
 *
 * 반환 타입은 Node `net.LookupFunction`. 통합 콜백 `(err, address|addresses, family?)`을
 * 쓴다: all:true면 주소 배열, 아니면 첫 안전 주소.
 */
export function createGuardedLookup(
  resolver: Resolver = defaultResolver,
  opts: { allowLoopback?: boolean } = {},
): LookupFunction {
  const allowLoopback = opts.allowLoopback ?? isLoopbackAllowed();
  return function guardedLookup(hostname, options, callback): void {
    const wantAll = typeof options === "object" && options?.all === true;
    const fail = (): void => {
      const err = new Error(`SSRF: 차단되었거나 해석 불가한 호스트: ${hostname}`) as NodeJS.ErrnoException;
      err.code = "ENOTFOUND";
      callback(err, "", undefined);
    };
    resolver(hostname)
      .then((addresses) => {
        const safe = addresses.filter((a) => !isBlockedAddress(a.address, { allowLoopback }));
        if (safe.length === 0) {
          fail();
        } else if (wantAll) {
          callback(null, safe);
        } else {
          const first = safe[0]!;
          callback(null, first.address, first.family);
        }
      })
      .catch(fail);
  };
}
