/**
 * 산출물 HTML 뷰어 (프레임워크 없는 vanilla TS). — technical-spec §1.3, §8
 * 빌드 산출물을 server가 export 시 템플릿으로 인라인한다.
 * T1은 스캐폴딩만. 실제 렌더는 T8에서 구현.
 */
import type { Scene, Annotation } from "@mockspec/shared";

/** 장면의 어노테이션을 번호 순으로 정렬해 반환 — 뷰어/편집기 공통 표시 순서. */
export function annotationsOf(scene: Scene, all: Annotation[]): Annotation[] {
  return all
    .filter((a) => a.sceneId === scene.id)
    .sort((a, b) => a.number - b.number);
}
