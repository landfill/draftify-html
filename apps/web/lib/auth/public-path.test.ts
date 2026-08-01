import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-path.js";

describe("isPublicPath", () => {
  it("정확 경로는 공개", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/guide")).toBe(true);
    expect(isPublicPath("/faq")).toBe(true);
    expect(isPublicPath("/sample")).toBe(true);
    expect(isPublicPath("/download")).toBe(true);
  });

  it("base/ 하위만 공개 — 접두 오탐 없음", () => {
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/download/mockspec-extension.zip")).toBe(true);
    expect(isPublicPath("/guidexyz")).toBe(false);
    expect(isPublicPath("/faqitem")).toBe(false);
    expect(isPublicPath("/sample-export")).toBe(false);
    expect(isPublicPath("/login-fake")).toBe(false);
    expect(isPublicPath("/download-fake")).toBe(false);
  });

  it("목업·API는 비공개", () => {
    expect(isPublicPath("/m/prj_abc1234567")).toBe(false);
    expect(isPublicPath("/api/projects")).toBe(false);
  });
});
