import { describe, expect, it } from "vitest";
import {
  isValidProjectId,
  resolveMockupRelativePath,
} from "./paths.js";
import { isSpaFallbackCandidate } from "./mime.js";

describe("resolveMockupRelativePath", () => {
  it("루트는 index.html", () => {
    expect(resolveMockupRelativePath(undefined)).toBe("index.html");
    expect(resolveMockupRelativePath([])).toBe("index.html");
  });

  it("중첩 정적 파일", () => {
    expect(resolveMockupRelativePath(["assets", "app.js"])).toBe("assets/app.js");
  });

  it("zip-slip 거부", () => {
    expect(resolveMockupRelativePath(["..", "etc", "passwd"])).toBeNull();
  });
});

describe("isSpaFallbackCandidate", () => {
  it("확장자 없으면 fallback 후보", () => {
    expect(isSpaFallbackCandidate("settings")).toBe(true);
    expect(isSpaFallbackCandidate("orders/1042")).toBe(true);
  });

  it("확장자 있으면 404", () => {
    expect(isSpaFallbackCandidate("app.js")).toBe(false);
    expect(isSpaFallbackCandidate("assets/style.css")).toBe(false);
  });
});

describe("isValidProjectId", () => {
  it("prj_ + 10자", () => {
    expect(isValidProjectId("prj_abc1234567")).toBe(true);
    expect(isValidProjectId("prj_short")).toBe(false);
  });
});
