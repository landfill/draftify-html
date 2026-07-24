import type { Scene } from "./types.js";

/** 공백만 있는 문자열은 없는 것으로 본다. */
function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

/** 산출물·편집 공통 표시 제목 — headerTitle이 있으면 우선, 없으면 title. */
export function sceneDisplayTitle(scene: Scene): string {
  const raw = scene.headerTitle?.trim() || scene.title?.trim();
  return raw || "(제목 없음)";
}

/** 페이지 헤더 밴드 렌더 여부 — 섹션 라벨 또는 headerTitle 중 하나라도 있으면 true. */
export function scenePageBandActive(scene: Scene): boolean {
  return hasText(scene.pageSectionLabel) || hasText(scene.headerTitle);
}

/** 스테이지 헤더 제목 문자열. 편집 화면은 SCR 코드를 앞에 붙인다. */
export function sceneStageHeaderTitle(scene: Scene, showScrCodes: boolean): string {
  if (showScrCodes) {
    const title = scene.title?.trim() || "(제목 없음)";
    return `${scene.code} ${title}`;
  }
  return sceneDisplayTitle(scene);
}

/** 사이드바·흐름도 등 장면 라벨. 편집은 SCR+title, 산출물은 표시 제목만. */
export function sceneNavLabel(scene: Scene, showScrCodes: boolean): string {
  if (showScrCodes) {
    return `${scene.code} ${scene.title?.trim() || "(제목 없음)"}`;
  }
  return sceneDisplayTitle(scene);
}

/** 직전 장면(정렬 order 기준)의 pageSectionLabel — 신규 장면 프리필용. */
export function previousSceneSectionLabel(scenes: Scene[], beforeOrder: number): string | undefined {
  const prev = scenes
    .filter((s) => s.order < beforeOrder)
    .sort((a, b) => b.order - a.order)[0];
  const label = prev?.pageSectionLabel?.trim();
  return label || undefined;
}
