import type { Scene, TargetDevice } from "./types.js";
import { MOBILE_RENDER_WIDTH } from "./types.js";

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

/**
 * 직전 장면(정렬 order 기준)의 targetDevice — 신규 장면 프리필용 (이슈 #99, 킥오프 11절 21차).
 * 섹션 라벨과 같은 방식이다. 직전 장면에 값이 없으면 비운 채 둔다 — 기본값을 부여하지 않는다.
 */
export function previousSceneTargetDevice(scenes: Scene[], beforeOrder: number): TargetDevice | undefined {
  const prev = scenes
    .filter((s) => s.order < beforeOrder)
    .sort((a, b) => b.order - a.order)[0];
  return prev?.targetDevice;
}

/**
 * 스냅샷 iframe의 렌더 기준 폭 (이슈 #99, 킥오프 11절 21차).
 * 대상 기기가 모바일이면 390px, 아니면 캡처 시점 폭 — 둘 다 없으면 호출부가 준 폴백.
 *
 * `captureWidth`는 기획자 브라우저 창 폭이라, 모바일 화면을 넓은 창에서 캡처하면 좌우가
 * 빈 채로 문서에 들어가고 fit 축소(19차 ④)마저 그 빈 폭을 포함해 배율을 계산한다.
 *
 * ⚠️ 뷰어(`packages/viewer/src/main.ts`)에 같은 로직이 복제돼 있다 — 산출물은 단일 모듈
 * 인라인이라 런타임 import가 불가능하다(18차). 고칠 때 양쪽을 함께 고친다.
 */
export function sceneRenderWidth(scene: Scene, fallbackWidth: number): number {
  if (scene.targetDevice === "mobile") return MOBILE_RENDER_WIDTH;
  return scene.captureWidth ?? fallbackWidth;
}
