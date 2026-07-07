import { describe, it, expect } from "vitest";
import { parseProjectSubdomain } from "./host.js";

describe("parseProjectSubdomain", () => {
  it("서브도메인에서 프로젝트 id를 뽑는다", () => {
    expect(parseProjectSubdomain("prj_abc123.localhost:4000")).toBe("prj_abc123");
    expect(parseProjectSubdomain("prj_abc123.localhost")).toBe("prj_abc123");
  });

  it("루트 도메인은 null (콘솔)", () => {
    expect(parseProjectSubdomain("localhost:4000")).toBeNull();
    expect(parseProjectSubdomain("localhost")).toBeNull();
  });

  it("id 형식이 아닌 라벨·중첩 서브도메인·빈 값은 null", () => {
    expect(parseProjectSubdomain("www.localhost")).toBeNull();     // prj_ 아님
    expect(parseProjectSubdomain("a.b.localhost")).toBeNull();     // 다중 라벨
    expect(parseProjectSubdomain("xyz_abc.localhost")).toBeNull(); // 접두 prj_ 아님
    expect(parseProjectSubdomain(undefined)).toBeNull();
  });

  it("호스트명은 대소문자 무시 — 대문자 서브도메인은 소문자 id로 정규화", () => {
    expect(parseProjectSubdomain("prj_ABC123.localhost")).toBe("prj_abc123");
  });
});
