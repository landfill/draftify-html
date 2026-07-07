import { customAlphabet } from "nanoid";
import type { Scene, Annotation, Anchor } from "@mockspec/shared";

/**
 * 편집 상태 (인메모리). SpecProject의 편집 대상 부분집합 — 서버 동기화는 T7,
 * 장면 동결(snapshotAsset)은 T6에서 얹는다.
 */
export interface EditorDoc {
  sceneCodeSeq: number;
  scenes: Scene[];
  annotations: Annotation[];
}

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const sceneId = () => `scn_${nano()}`;
const annId = () => `ann_${nano()}`;

export function emptyDoc(): EditorDoc {
  return { sceneCodeSeq: 1, scenes: [], annotations: [] };
}

/** SCR-### 표시 코드 (생성 순, 영구 불변 — output-standard §1.2). */
export function sceneCode(seq: number): string {
  return `SCR-${String(seq).padStart(3, "0")}`;
}

/** 장면 생성. 반환 doc의 sceneCodeSeq는 단조 증가(재부여 방지). 동결은 T6. */
export function createScene(
  doc: EditorDoc,
  fields: { title: string; route: string; stateNote?: string },
): { doc: EditorDoc; scene: Scene } {
  const scene: Scene = {
    id: sceneId(),
    code: sceneCode(doc.sceneCodeSeq),
    title: fields.title,
    route: fields.route,
    stateNote: fields.stateNote,
    order: doc.scenes.length,
    annoNumberSeq: 1,
  };
  return {
    doc: { ...doc, sceneCodeSeq: doc.sceneCodeSeq + 1, scenes: [...doc.scenes, scene] },
    scene,
  };
}

/** 장면 삭제 + 소속 어노테이션 삭제. */
export function deleteScene(doc: EditorDoc, id: string): EditorDoc {
  return {
    ...doc,
    scenes: doc.scenes.filter((s) => s.id !== id),
    annotations: doc.annotations.filter((a) => a.sceneId !== id),
  };
}

/** 어노테이션 부착. 장면 내 번호를 단조 증가로 부여(삭제 시 재부여 금지). */
export function addAnnotation(
  doc: EditorDoc,
  sceneId: string,
  anchor: Anchor,
): { doc: EditorDoc; annotation: Annotation } {
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`scene ${sceneId} not found`);
  const annotation: Annotation = {
    id: annId(),
    sceneId,
    number: scene.annoNumberSeq,
    anchor,
    title: "",
    description: "",
  };
  return {
    doc: {
      ...doc,
      scenes: doc.scenes.map((s) =>
        s.id === sceneId ? { ...s, annoNumberSeq: s.annoNumberSeq + 1 } : s,
      ),
      annotations: [...doc.annotations, annotation],
    },
    annotation,
  };
}

export function updateAnnotation(doc: EditorDoc, id: string, patch: Partial<Annotation>): EditorDoc {
  return {
    ...doc,
    annotations: doc.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function deleteAnnotation(doc: EditorDoc, id: string): EditorDoc {
  // 번호는 재부여하지 않는다 — annoNumberSeq는 유지 (빈 번호 허용).
  return { ...doc, annotations: doc.annotations.filter((a) => a.id !== id) };
}

export function annotationsOfScene(doc: EditorDoc, sceneId: string): Annotation[] {
  return doc.annotations.filter((a) => a.sceneId === sceneId).sort((a, b) => a.number - b.number);
}

/** 앵커 selector 자동 갱신(재탐색 성공 시)을 상태에 반영. */
export function updateAnchorSelector(doc: EditorDoc, annId: string, selector: string): EditorDoc {
  return {
    ...doc,
    annotations: doc.annotations.map((a) =>
      a.id === annId ? { ...a, anchor: { ...a.anchor, selector } } : a,
    ),
  };
}
