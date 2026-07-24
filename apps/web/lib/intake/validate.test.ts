import { describe, it, expect } from "vitest";
import { validateManifestShape, ManifestValidationError } from "./validate.js";
import type { MockupManifest } from "./types.js";

const base: MockupManifest = {
  entries: ["index.html", "a.js"],
  indexPath: "index.html",
  excluded: [],
};

describe("validateManifestShape", () => {
  it("정상 manifest를 통과시킨다", () => {
    expect(() => validateManifestShape(base, "prj_abc")).not.toThrow();
  });

  it("index.html 누락을 거부한다", () => {
    const bad = { ...base, entries: ["a.js"] };
    expect(() => validateManifestShape(bad, "prj_abc")).toThrow(ManifestValidationError);
  });

  it("위험 경로를 거부한다", () => {
    const bad = { ...base, entries: ["../evil.html", "index.html"] };
    expect(() => validateManifestShape(bad, "prj_abc")).toThrow(ManifestValidationError);
  });
});
