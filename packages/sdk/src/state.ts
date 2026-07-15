import { customAlphabet } from "nanoid";
import type { SpecProject, Scene, Annotation, Anchor } from "@mockspec/shared";

/**
 * 편집 상태 (인메모리). 서버 저장 시 SpecProject에 다시 합쳐 전체 문서 PUT으로 보낸다.
 * 장면 캡처(snapshotAsset·frozenAt)는 setSceneSnapshot으로 기록한다.
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

export function docFromProject(project: SpecProject): EditorDoc {
  return {
    sceneCodeSeq: project.sceneCodeSeq,
    scenes: project.scenes,
    annotations: project.annotations,
  };
}

export function applyDocToProject(project: SpecProject, doc: EditorDoc): SpecProject {
  return {
    ...project,
    sceneCodeSeq: doc.sceneCodeSeq,
    scenes: doc.scenes,
    annotations: doc.annotations,
  };
}

/**
 * 서버가 updatedAt을 갱신해도 같은 문서를 다시 저장하지 않기 위한 비교 키.
 * S1은 전체 문서 PUT이고 단일 편집자 전제라 updatedAt 외 메타/본문을 그대로 비교한다.
 */
export function projectContentSignature(project: SpecProject): string {
  const { updatedAt: _updatedAt, ...content } = project;
  return JSON.stringify(content);
}

/** SCR-### 표시 코드 (생성 순, 영구 불변 — output-standard §1.2). */
export function sceneCode(seq: number): string {
  return `SCR-${String(seq).padStart(3, "0")}`;
}

/** 장면 생성. 반환 doc의 sceneCodeSeq는 단조 증가(재부여 방지). 캡처는 App이 등록 직후 트리거. */
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

/** 장면 삭제 + 소속 어노테이션 삭제 + 그 장면을 향한 전이 제거 (dangling 방지 — §3.10). */
export function deleteScene(doc: EditorDoc, id: string): EditorDoc {
  return {
    ...doc,
    scenes: doc.scenes.filter((s) => s.id !== id),
    annotations: doc.annotations
      .filter((a) => a.sceneId !== id)
      .map((a) => (a.transition?.toSceneId === id ? { ...a, transition: undefined } : a)),
  };
}

/** 현재 남아 있는 어노테이션 기준 다음 번호. 중간 결번은 유지하고 끝 번호만 재사용한다. */
function nextAnnotationNumber(annotations: Annotation[], sceneId: string): number {
  return annotations.reduce(
    (max, annotation) => annotation.sceneId === sceneId ? Math.max(max, annotation.number) : max,
    0,
  ) + 1;
}

/** 어노테이션 부착. 장면 내 현재 최대 번호+1을 부여한다(킥오프 §11 12차). */
export function addAnnotation(
  doc: EditorDoc,
  sceneId: string,
  anchor: Anchor,
): { doc: EditorDoc; annotation: Annotation } {
  const scene = doc.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`scene ${sceneId} not found`);
  const number = nextAnnotationNumber(doc.annotations, sceneId);
  const annotation: Annotation = {
    id: annId(),
    sceneId,
    number,
    anchor,
    title: "",
    description: "",
  };
  return {
    doc: {
      ...doc,
      scenes: doc.scenes.map((s) =>
        s.id === sceneId ? { ...s, annoNumberSeq: number + 1 } : s,
      ),
      annotations: [...doc.annotations, annotation],
    },
    annotation,
  };
}

/** 캡처 성공 시 장면에 snapshotAsset·frozenAt·캡처 뷰포트 크기 기록 (재캡처면 덮어쓴다). */
export function setSceneSnapshot(
  doc: EditorDoc,
  sceneId: string,
  snapshotAsset: string,
  frozenAt: string,
  capture?: { width: number; height: number },
): EditorDoc {
  return {
    ...doc,
    scenes: doc.scenes.map((s) =>
      s.id === sceneId
        ? { ...s, snapshotAsset, frozenAt, captureWidth: capture?.width, captureHeight: capture?.height }
        : s,
    ),
  };
}

/** 장면 제목 수정 — 패널 인라인 편집 (기본 제목 자동 부여 철회, 킥오프 §11 8차). */
export function updateSceneTitle(doc: EditorDoc, sceneId: string, title: string): EditorDoc {
  return {
    ...doc,
    scenes: doc.scenes.map((s) => (s.id === sceneId ? { ...s, title } : s)),
  };
}

export function updateAnnotation(doc: EditorDoc, id: string, patch: Partial<Annotation>): EditorDoc {
  return {
    ...doc,
    annotations: doc.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

export function deleteAnnotation(doc: EditorDoc, id: string): EditorDoc {
  const deleted = doc.annotations.find((a) => a.id === id);
  if (!deleted) return doc;

  const annotations = doc.annotations.filter((a) => a.id !== id);
  return {
    ...doc,
    scenes: doc.scenes.map((scene) => scene.id === deleted.sceneId
      ? { ...scene, annoNumberSeq: nextAnnotationNumber(annotations, deleted.sceneId) }
      : scene),
    annotations,
  };
}

/** 미작성 핀 — title·description 모두 공백. 유지하되 구분 표시한다 (킥오프 §11 5차 개정). */
export function isEmptyAnnotation(a: Annotation): boolean {
  return !a.title.trim() && !a.description.trim();
}

/** 장면 내 미작성(빈) 어노테이션 일괄 삭제 — 패널 [빈 어노테이션 정리] 버튼. */
export function deleteEmptyAnnotations(doc: EditorDoc, sceneId: string): EditorDoc {
  const annotations = doc.annotations.filter((a) => a.sceneId !== sceneId || !isEmptyAnnotation(a));
  return {
    ...doc,
    scenes: doc.scenes.map((scene) => scene.id === sceneId
      ? { ...scene, annoNumberSeq: nextAnnotationNumber(annotations, sceneId) }
      : scene),
    annotations,
  };
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
