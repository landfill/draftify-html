import { describe, expect, it } from "vitest";
import type { Anchor, SpecProject } from "@mockspec/shared";
import {
  applyDocToProject, createScene, deleteAnnotation, deleteEmptyAnnotations, deleteScene, docFromProject,
  projectContentSignature, updateAnnotation, addAnnotation, setSceneSnapshot, updateSceneTitle,
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

  it("동결 기록에 캡처 뷰포트 크기가 함께 저장된다 — 뷰어의 반응형(폭)·100vh류(높이) 재현 기준", () => {
    const doc = docFromProject(project);
    const frozen = setSceneSnapshot(doc, "scn_one", "asset_snap0001", "2026-07-12T00:00:00.000Z", {
      width: 1440,
      height: 900,
    });
    expect(frozen.scenes[0]).toMatchObject({
      snapshotAsset: "asset_snap0001",
      frozenAt: "2026-07-12T00:00:00.000Z",
      captureWidth: 1440,
      captureHeight: 900,
    });
  });

  it("장면 제목은 기본값 없이 인라인 편집으로 지정한다 (킥오프 §11 8차)", () => {
    let doc = docFromProject(project);
    doc = updateSceneTitle(doc, "scn_one", "메인 스튜디오");
    expect(doc.scenes[0]?.title).toBe("메인 스튜디오");
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

describe("어노테이션 번호 할당 (킥오프 §11 12차)", () => {
  const anchor: Anchor = { selector: "body > button", rect: { x: 0, y: 0, w: 0.1, h: 0.1 } };

  it("중간 결번은 유지하고 삭제한 끝 번호만 다음 생성에서 재사용한다", () => {
    let doc = docFromProject(project);
    const added = [];
    for (let i = 0; i < 4; i += 1) {
      const result = addAnnotation(doc, "scn_one", anchor);
      doc = result.doc;
      added.push(result.annotation);
    }

    doc = deleteAnnotation(doc, added[1]!.id);
    expect(doc.annotations.map((annotation) => annotation.number)).toEqual([1, 3, 4]);

    const fifth = addAnnotation(doc, "scn_one", anchor);
    expect(fifth.annotation.number).toBe(5);
    doc = deleteAnnotation(fifth.doc, fifth.annotation.id);

    const reused = addAnnotation(doc, "scn_one", anchor);
    expect(reused.annotation.number).toBe(5);
    expect(reused.doc.scenes[0]?.annoNumberSeq).toBe(6);
  });

  it("빈 어노테이션 정리로 끝 번호가 삭제되어도 다음 번호를 다시 계산한다", () => {
    let doc = docFromProject(project);
    const first = addAnnotation(doc, "scn_one", anchor);
    doc = updateAnnotation(first.doc, first.annotation.id, { title: "유지" });
    const second = addAnnotation(doc, "scn_one", anchor);
    doc = updateAnnotation(second.doc, second.annotation.id, { title: "유지" });
    doc = addAnnotation(doc, "scn_one", anchor).doc;

    doc = deleteEmptyAnnotations(doc, "scn_one");
    expect(doc.annotations.map((annotation) => annotation.number)).toEqual([1, 2]);
    expect(addAnnotation(doc, "scn_one", anchor).annotation.number).toBe(3);
  });
});
