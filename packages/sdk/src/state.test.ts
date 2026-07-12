import { describe, expect, it } from "vitest";
import type { Anchor, SpecProject } from "@mockspec/shared";
import {
  applyDocToProject, createScene, deleteScene, docFromProject,
  projectContentSignature, updateAnnotation, addAnnotation,
} from "./state.js";

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

describe("전이 (T27, §3.10)", () => {
  const anchor: Anchor = { selector: "body > button:nth-of-type(1)", rect: { x: 0, y: 0, w: 0.1, h: 0.1 } };

  it("전이 지정·해제가 updateAnnotation으로 저장·제거된다", () => {
    let doc = docFromProject(project);
    const target = createScene(doc, { title: "결과", route: "/done" });
    doc = target.doc;
    const added = addAnnotation(doc, "scn_one", anchor);
    doc = added.doc;

    doc = updateAnnotation(doc, added.annotation.id, {
      transition: { toSceneId: target.scene.id, condition: "성공 시" },
    });
    expect(doc.annotations[0]?.transition).toEqual({ toSceneId: target.scene.id, condition: "성공 시" });

    doc = updateAnnotation(doc, added.annotation.id, { transition: undefined });
    expect(doc.annotations[0]?.transition).toBeUndefined();
  });

  it("대상 장면을 삭제하면 그 장면을 향한 전이가 함께 제거된다 (dangling 방지)", () => {
    let doc = docFromProject(project);
    const target = createScene(doc, { title: "결과", route: "/done" });
    doc = target.doc;
    const added = addAnnotation(doc, "scn_one", anchor);
    doc = added.doc;
    doc = updateAnnotation(doc, added.annotation.id, {
      transition: { toSceneId: target.scene.id },
    });

    doc = deleteScene(doc, target.scene.id);

    // 어노테이션 자체(다른 장면 소속)는 남고 transition만 사라진다
    const ann = doc.annotations.find((a) => a.id === added.annotation.id);
    expect(ann).toBeDefined();
    expect(ann?.transition).toBeUndefined();
    // 직렬화(spec.json 형식)에서도 필드가 남지 않는다
    const serialized = JSON.parse(JSON.stringify(applyDocToProject(project, doc))) as SpecProject;
    expect(serialized.annotations[0]).not.toHaveProperty("transition");
  });
});
