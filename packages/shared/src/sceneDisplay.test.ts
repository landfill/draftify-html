import { describe, it, expect } from "vitest";
import type { Scene } from "./types.js";
import {
  previousSceneSectionLabel,
  sceneDisplayTitle,
  sceneNavLabel,
  scenePageBandActive,
  sceneStageHeaderTitle,
} from "./sceneDisplay.js";

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: "scn_test00001",
    code: "SCR-001",
    title: "로그인",
    route: "/login",
    order: 0,
    annoNumberSeq: 1,
    ...overrides,
  };
}

describe("sceneDisplay helpers (이슈 #38)", () => {
  it("sceneDisplayTitle — headerTitle 우선, 없으면 title", () => {
    expect(sceneDisplayTitle(scene())).toBe("로그인");
    expect(sceneDisplayTitle(scene({ headerTitle: "주요 작업 ②" }))).toBe("주요 작업 ②");
    expect(sceneDisplayTitle(scene({ title: "", headerTitle: "" }))).toBe("(제목 없음)");
  });

  it("scenePageBandActive — 섹션 라벨 또는 headerTitle 중 하나라도 있으면 true", () => {
    expect(scenePageBandActive(scene())).toBe(false);
    expect(scenePageBandActive(scene({ pageSectionLabel: "03 화면상세" }))).toBe(true);
    expect(scenePageBandActive(scene({ headerTitle: "페이지 타이틀" }))).toBe(true);
    expect(scenePageBandActive(scene({ pageSectionLabel: "  ", headerTitle: "" }))).toBe(false);
  });

  it("sceneStageHeaderTitle — 편집은 SCR+title, 산출물은 표시 제목만", () => {
    expect(sceneStageHeaderTitle(scene(), true)).toBe("SCR-001 로그인");
    expect(sceneStageHeaderTitle(scene({ headerTitle: "페이지" }), false)).toBe("페이지");
    expect(sceneStageHeaderTitle(scene(), false)).toBe("로그인");
  });

  it("sceneNavLabel — 편집/산출물 분기", () => {
    expect(sceneNavLabel(scene(), true)).toBe("SCR-001 로그인");
    expect(sceneNavLabel(scene(), false)).toBe("로그인");
  });

  it("previousSceneSectionLabel — order 기준 직전 장면의 섹션 라벨", () => {
    const scenes = [
      scene({ id: "scn_a", order: 0, pageSectionLabel: "01 개요" }),
      scene({ id: "scn_b", order: 1 }),
      scene({ id: "scn_c", order: 2, pageSectionLabel: "03 화면상세" }),
    ];
    expect(previousSceneSectionLabel(scenes, 1)).toBe("01 개요");
    expect(previousSceneSectionLabel(scenes, 3)).toBe("03 화면상세");
    expect(previousSceneSectionLabel(scenes, 0)).toBeUndefined();
  });
});
