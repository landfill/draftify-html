import { describe, it, expect } from "vitest";
import type { Scene } from "@mockspec/shared";
import {
  sceneDisplayTitle,
  sceneNavLabel,
  scenePageBandActive,
  sceneStageHeaderTitle,
} from "@mockspec/shared";
import {
  sceneDisplayTitle as viewerSceneDisplayTitle,
  sceneNavLabel as viewerSceneNavLabel,
  scenePageBandActive as viewerScenePageBandActive,
  sceneStageHeaderTitle as viewerSceneStageHeaderTitle,
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
  }
});
