import { describe, it, expect } from "vitest";
import {
  ALLOWLIST_ENV,
  getAllowlist,
  isAllowlisted,
  isBlockedAddress,
  validateOrigin,
  createGuardedLookup,
  SsrfError,
  type Resolver,
  type ResolvedAddress,
} from "./ssrfGuard.js";

/** 고정 응답 리졸버 — 실제 DNS/네트워크를 건드리지 않는다. */
function fixedResolver(map: Record<string, ResolvedAddress[]>): Resolver {
  return async (hostname) => {
    const hit = map[hostname];
    if (!hit) throw new Error(`ENOTFOUND ${hostname}`);
    return hit;
  };
}
const v4 = (address: string): ResolvedAddress => ({ address, family: 4 });
const v6 = (address: string): ResolvedAddress => ({ address, family: 6 });

describe("SSRF 가드 — allowlist (T12)", () => {
  it("env 미설정/빈 값이면 빈 목록 (deny-by-default)", () => {
    expect(getAllowlist({})).toEqual([]);
    expect(getAllowlist({ [ALLOWLIST_ENV]: "  ,  , " })).toEqual([]);
  });

  it("콤마 구분 + trim + 소문자 정규화", () => {
    expect(getAllowlist({ [ALLOWLIST_ENV]: " Mockup.Team-A.internal , *.Staging.example.com " })).toEqual([
      "mockup.team-a.internal",
      "*.staging.example.com",
    ]);
  });

  it("정확 일치", () => {
    const list = ["mockup.team-a.internal"];
    expect(isAllowlisted("mockup.team-a.internal", list)).toBe(true);
    expect(isAllowlisted("MOCKUP.team-a.internal", list)).toBe(true); // 대소문자 무관
    expect(isAllowlisted("evil.team-a.internal", list)).toBe(false);
  });

  it("*. 와일드카드는 1단계 이상 서브도메인만 매칭", () => {
    const list = ["*.staging.example.com"];
    expect(isAllowlisted("a.staging.example.com", list)).toBe(true);
    expect(isAllowlisted("a.b.staging.example.com", list)).toBe(true);
    expect(isAllowlisted("staging.example.com", list)).toBe(false); // 라벨 없음
    expect(isAllowlisted("evilstaging.example.com", list)).toBe(false); // 접미 위조 방지
  });

  it("빈 allowlist는 무엇도 허용하지 않는다", () => {
    expect(isAllowlisted("mockup.team-a.internal", [])).toBe(false);
  });
});

describe("SSRF 가드 — hard-deny IP (T12)", () => {
  it("루프백·unspecified·링크로컬(메타데이터)·ULA는 차단", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("0.0.0.0")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true); // 클라우드 메타데이터
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("::")).toBe(true);
    expect(isBlockedAddress("fe80::1")).toBe(true);
    expect(isBlockedAddress("fd00::1")).toBe(true); // ULA
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true); // IPv4-mapped
  });

  it("사설 대역은 hard-deny하지 않는다 (사내 스테이징)", () => {
    expect(isBlockedAddress("10.1.2.3")).toBe(false);
    expect(isBlockedAddress("172.16.0.5")).toBe(false);
    expect(isBlockedAddress("192.168.1.10")).toBe(false);
    expect(isBlockedAddress("203.0.113.7")).toBe(false); // 공인 IP
  });

  it("IP 형식이 아니면 차단", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true);
    expect(isBlockedAddress("999.1.1.1")).toBe(true);
  });
});

describe("SSRF 가드 — validateOrigin (T12)", () => {
  const env = { [ALLOWLIST_ENV]: "mockup.team-a.internal, *.staging.example.com" };
  const resolver = fixedResolver({
    "mockup.team-a.internal": [v4("10.0.0.5")],
    "app.staging.example.com": [v4("192.168.10.20")],
    "rebind.staging.example.com": [v4("169.254.169.254")], // allowlist엔 있지만 메타데이터로 해석
    "multi.staging.example.com": [v4("10.0.0.9"), v4("127.0.0.1")], // 하나라도 위험하면 거부
  });

  it("allowlist + 안전한 사설 IP → 통과", async () => {
    const ok = await validateOrigin("https://mockup.team-a.internal/path?q=1", { resolver, env });
    expect(ok.hostname).toBe("mockup.team-a.internal");
    expect(ok.addresses).toEqual([v4("10.0.0.5")]);
  });

  it("http/https 아닌 프로토콜 → PROTOCOL", async () => {
    await expect(validateOrigin("ftp://mockup.team-a.internal", { resolver, env })).rejects.toMatchObject({
      reason: "PROTOCOL",
    });
    await expect(validateOrigin("file:///etc/passwd", { resolver, env })).rejects.toBeInstanceOf(SsrfError);
  });

  it("allowlist 미매칭 → NOT_ALLOWLISTED", async () => {
    await expect(validateOrigin("https://evil.example.com", { resolver, env })).rejects.toMatchObject({
      reason: "NOT_ALLOWLISTED",
    });
  });

  it("빈 allowlist → 매칭 불가로 NOT_ALLOWLISTED (deny-by-default)", async () => {
    await expect(validateOrigin("https://mockup.team-a.internal", { resolver, env: {} })).rejects.toMatchObject({
      reason: "NOT_ALLOWLISTED",
    });
  });

  it("allowlist에 있어도 메타데이터 IP로 해석되면 BLOCKED_ADDRESS", async () => {
    await expect(
      validateOrigin("https://rebind.staging.example.com", { resolver, env }),
    ).rejects.toMatchObject({ reason: "BLOCKED_ADDRESS" });
  });

  it("다중 A레코드 중 하나라도 위험하면 거부", async () => {
    await expect(
      validateOrigin("https://multi.staging.example.com", { resolver, env }),
    ).rejects.toMatchObject({ reason: "BLOCKED_ADDRESS" });
  });

  it("해석 불가 호스트 → UNRESOLVABLE", async () => {
    const emptyResolver: Resolver = async () => [];
    await expect(
      validateOrigin("https://app.staging.example.com", { resolver: emptyResolver, env }),
    ).rejects.toMatchObject({ reason: "UNRESOLVABLE" });
  });
});

describe("SSRF 가드 — IP 고정 lookup 훅 (T12)", () => {
  it("검증된 IP만 콜백으로 돌려준다 (all:false → 첫 안전 주소)", async () => {
    const lookup = createGuardedLookup(fixedResolver({ h: [v4("10.0.0.5"), v4("10.0.0.6")] }));
    const got = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      lookup("h", {}, (err, address, family) => (err ? reject(err) : resolve({ address, family })));
    });
    expect(got).toEqual({ address: "10.0.0.5", family: 4 });
  });

  it("all:true면 안전한 주소만 배열로 (위험 주소는 걸러냄)", async () => {
    const lookup = createGuardedLookup(fixedResolver({ h: [v4("10.0.0.5"), v4("127.0.0.1"), v6("fd00::1")] }));
    const got = await new Promise<ResolvedAddress[]>((resolve, reject) => {
      lookup("h", { all: true }, (err, addrs) => (err ? reject(err) : resolve(addrs)));
    });
    expect(got).toEqual([v4("10.0.0.5")]);
  });

  it("안전한 주소가 하나도 없으면 ENOTFOUND로 연결 실패", async () => {
    const lookup = createGuardedLookup(fixedResolver({ h: [v4("169.254.169.254")] }));
    const err = await new Promise<NodeJS.ErrnoException>((resolve) => {
      lookup("h", { all: true }, (e) => resolve(e as NodeJS.ErrnoException));
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("ENOTFOUND");
  });

  it("리졸버 자체가 실패해도 ENOTFOUND로 처리", async () => {
    const lookup = createGuardedLookup(fixedResolver({}));
    const err = await new Promise<NodeJS.ErrnoException>((resolve) => {
      lookup("missing", undefined, (e) => resolve(e as NodeJS.ErrnoException));
    });
    expect(err.code).toBe("ENOTFOUND");
  });
});
