import { describe, it, expect } from "vitest";
import type { Scene } from "@mockspec/shared";
import {
  sceneDisplayTitle,
  sceneNavLabel,
  scenePageBandActive,
  sceneStageHeaderTitle,
  sceneRenderWidth,
} from "@mockspec/shared";
import {
  sceneDisplayTitle as viewerSceneDisplayTitle,
  sceneNavLabel as viewerSceneNavLabel,
  scenePageBandActive as viewerScenePageBandActive,
  sceneStageHeaderTitle as viewerSceneStageHeaderTitle,
  sceneRenderWidth as viewerSceneRenderWidth,
} from "./main.js";

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scn_parity0001",
    code: "SCR-001",
    title: "로그인",
    route: "/login",
    order: 0,
    annoNumberSeq: 1,
    ...overrides,
  };
}

const fixtures: Scene[] = [
  scene(),
  scene({ title: "", headerTitle: "페이지 타이틀" }),
  scene({ title: "내부", headerTitle: "페이지", pageSectionLabel: "03 화면상세" }),
  scene({ title: "", headerTitle: "", pageSectionLabel: "  " }),
  scene({ code: "SCR-042", title: "통계", headerTitle: undefined, pageSectionLabel: "02 흐름" }),
  // [이슈 #99] 대상 기기 — 렌더 폭이 갈리는 조합을 모두 덮는다
  scene({ targetDevice: "mobile", captureWidth: 1470 }),
  scene({ targetDevice: "desktop", captureWidth: 1470 }),
  scene({ targetDevice: "mobile" }),                  // 캡처 폭 없음 → 그래도 390
  scene({ targetDevice: undefined, captureWidth: 1470 }), // 미지정 → 현행(캡처 폭)
  scene({ targetDevice: undefined }),                 // 둘 다 없음 → 폴백
];

describe("viewer ↔ shared sceneDisplay 동등성 (산출물 단일 모듈 인라인 제약)", () => {
  for (const [index, fixture] of fixtures.entries()) {
    it(`fixture ${index + 1}: sceneDisplayTitle`, () => {
      expect(viewerSceneDisplayTitle(fixture)).toBe(sceneDisplayTitle(fixture));
    });

    it(`fixture ${index + 1}: scenePageBandActive`, () => {
      expect(viewerScenePageBandActive(fixture)).toBe(scenePageBandActive(fixture));
    });

    it(`fixture ${index + 1}: sceneStageHeaderTitle (export)`, () => {
      expect(viewerSceneStageHeaderTitle(fixture, false)).toBe(sceneStageHeaderTitle(fixture, false));
    });

    it(`fixture ${index + 1}: sceneStageHeaderTitle (edit)`, () => {
      expect(viewerSceneStageHeaderTitle(fixture, true)).toBe(sceneStageHeaderTitle(fixture, true));
    });

    it(`fixture ${index + 1}: sceneNavLabel (export)`, () => {
      expect(viewerSceneNavLabel(fixture, false)).toBe(sceneNavLabel(fixture, false));
    });

    it(`fixture ${index + 1}: sceneNavLabel (edit)`, () => {
      expect(viewerSceneNavLabel(fixture, true)).toBe(sceneNavLabel(fixture, true));
    });

    it(`fixture ${index + 1}: sceneRenderWidth`, () => {
      // 폴백 값 자체도 함께 검증한다 — 복제본이 폴백을 무시하면 여기서 갈린다
      expect(viewerSceneRenderWidth(fixture, 908)).toBe(sceneRenderWidth(fixture, 908));
    });
  }

  it("모바일은 캡처 폭·폴백과 무관하게 390px이다 (킥오프 11절 21차)", () => {
    expect(sceneRenderWidth(scene({ targetDevice: "mobile", captureWidth: 1470 }), 908)).toBe(390);
    expect(viewerSceneRenderWidth(scene({ targetDevice: "mobile" }), 908)).toBe(390);
  });

  it("미지정·desktop은 현행 그대로 캡처 폭을 쓴다 (동작 변화 0)", () => {
    expect(sceneRenderWidth(scene({ captureWidth: 1470 }), 908)).toBe(1470);
    expect(sceneRenderWidth(scene({ targetDevice: "desktop", captureWidth: 1470 }), 908)).toBe(1470);
    expect(sceneRenderWidth(scene({}), 908)).toBe(908); // 구 스냅샷 폴백 계약 유지
  });
});
