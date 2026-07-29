import { describe, it, expect } from "vitest";
import { safeNextPath } from "./safe-next.js";

describe("safeNextPath — 인증 콜백 오픈 리다이렉트 방지 (PR #44 리뷰)", () => {
  it("같은 오리진 경로는 그대로 통과한다", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/guide")).toBe("/guide");
    expect(safeNextPath("/m/prj_abc/?x=1#y")).toBe("/m/prj_abc/?x=1#y");
  });

  it("값이 없으면 루트", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("절대 URL은 막는다 — new URL(next, origin)이 origin을 무시하고 외부로 나간다", () => {
    expect(safeNextPath("https://attacker.example")).toBe("/");
    expect(safeNextPath("http://attacker.example/x")).toBe("/");
  });

  it("프로토콜 상대 URL도 막는다 — `/`로 시작한다고 안전한 것이 아니다", () => {
    expect(safeNextPath("//attacker.example")).toBe("/");
    expect(safeNextPath("//attacker.example/path")).toBe("/");
  });

  it("백슬래시 변형을 막는다 — 슬래시로 해석하는 브라우저가 있다", () => {
    expect(safeNextPath("/\\attacker.example")).toBe("/");
  });

  it("스킴만 붙인 형태도 상대 경로가 아니므로 막힌다", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("data:text/html,x")).toBe("/");
  });
});
