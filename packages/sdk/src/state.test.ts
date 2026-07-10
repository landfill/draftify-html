import { describe, expect, it } from "vitest";
import type { SpecProject } from "@mockspec/shared";
import { applyDocToProject, docFromProject, projectContentSignature } from "./state.js";

const project: SpecProject = {
  version: 1,
  id: "prj_state123",
  name: "상태",
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z",
  mockupSource: {
    type: "upload",
    originalFilename: "dist.zip",
    uploadedAt: "2026-07-07T00:00:00.000Z",
  },
  sceneCodeSeq: 2,
  scenes: [
    {
      id: "scn_one",
      code: "SCR-001",
      title: "홈",
      route: "/",
      order: 0,
      annoNumberSeq: 1,
    },
  ],
  annotations: [],
};

describe("EditorDoc ↔ SpecProject 변환 (T7)", () => {
  it("SpecProject의 편집 대상 필드를 EditorDoc으로 꺼내고 다시 합친다", () => {
    const doc = docFromProject(project);
    const next = applyDocToProject(project, { ...doc, sceneCodeSeq: 3, annotations: [] });

    expect(doc.scenes[0]?.code).toBe("SCR-001");
    expect(next.id).toBe(project.id);
    expect(next.mockupSource).toEqual(project.mockupSource);
    expect(next.sceneCodeSeq).toBe(3);
  });

  it("updatedAt만 다른 서버 응답은 같은 내용으로 본다", () => {
    const saved: SpecProject = { ...project, updatedAt: "2026-07-07T00:00:05.000Z" };

    expect(projectContentSignature(saved)).toBe(projectContentSignature(project));
  });
});
