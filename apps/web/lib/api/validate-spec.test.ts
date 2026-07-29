import { describe, expect, it } from "vitest";
import type { SpecProject } from "@mockspec/shared";
import { validatePutSpec } from "./validate-spec.js";

const base: SpecProject = {
  version: 1,
  id: "prj_test000001",
  name: "테스트",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  mockupSource: { type: "upload", originalFilename: "a.zip", uploadedAt: "2026-01-01T00:00:00.000Z" },
  sceneCodeSeq: 1,
  scenes: [],
  annotations: [],
};

describe("validatePutSpec", () => {
  it("유효한 본문 통과", () => {
    const body = {
      ...base,
      scenes: [
        {
          id: "scn_a",
          code: "SCR-001",
          title: "홈",
          route: "/",
          order: 0,
          annoNumberSeq: 1,
          pageSectionLabel: "03 화면상세",
          headerTitle: "주요 작업",
        },
      ],
    };
    const r = validatePutSpec(body, base.id, base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.scenes[0]?.pageSectionLabel).toBe("03 화면상세");
      expect(r.spec.mockupSource).toEqual(base.mockupSource);
    }
  });

  it("id 불일치 거부", () => {
    const r = validatePutSpec({ ...base, id: "prj_other0001" }, base.id, base);
    expect(r.ok).toBe(false);
  });
});
