// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import type { Anchor, Annotation, Scene, SpecProject } from "@mockspec/shared";
import {
  annotationsOf,
  buildFlowEdges,
  buildFlowNodes,
  decodeBase64Utf8,
  markdownToHtml,
  orderedScenes,
  readEmbeddedSnapshots,
  renderViewer,
  resolveAnchor,
} from "./main.js";

function project(overrides: Partial<SpecProject> = {}): SpecProject {
  return {
    version: 1,
    id: "prj_viewer",
    name: "뷰어",
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    mockupSource: { type: "upload", originalFilename: "dist.zip", uploadedAt: "2026-07-07T00:00:00.000Z" },
    sceneCodeSeq: 3,
    scenes: [],
    annotations: [],
    ...overrides,
  };
}

function scene(id: string, order: number): Scene {
  return { id, code: `SCR-00${order + 1}`, title: id, route: "/", order, annoNumberSeq: 1 };
}

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "ann_1",
    sceneId: "scn_1",
    number: 1,
    title: "제목",
    description: "본문",
    anchor: { selector: "#target", text: "저장", rect: { x: 0.1, y: 0.2, w: 0.2, h: 0.1 } },
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("viewer helpers", () => {
  it("장면은 order 순, 어노테이션은 장면 내 번호 순으로 정렬한다", () => {
    const scenes = [scene("scn_2", 1), scene("scn_1", 0)];
    const p = project({ scenes });
    expect(orderedScenes(p).map((s) => s.id)).toEqual(["scn_1", "scn_2"]);
    expect(annotationsOf(scenes[1]!, [
      annotation({ id: "ann_3", number: 3 }),
      annotation({ id: "ann_1", number: 1 }),
      annotation({ id: "ann_other", sceneId: "scn_2", number: 1 }),
    ]).map((a) => a.number)).toEqual([1, 3]);
  });

  it("base64 snapshot을 UTF-8 HTML로 복원한다", () => {
    const html = "<!doctype html><p>한글 snapshot</p>";
    const base64 = Buffer.from(html, "utf8").toString("base64");
    expect(decodeBase64Utf8(base64)).toBe(html);

    document.body.innerHTML = `<script type="text/plain" data-snapshot="scn_1">${base64}</script>`;
    expect(readEmbeddedSnapshots(document).get("scn_1")).toBe(html);
  });

  it("description markdown은 HTML을 escape한 뒤 제한적으로 렌더한다", () => {
    const rendered = markdownToHtml("안전한 **강조**\n<script>alert(1)</script>");
    expect(rendered).toContain("<strong>강조</strong>");
    expect(rendered).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(rendered).not.toContain("<script>alert");
  });
});

describe("viewer anchor resolve", () => {
  it("selector가 흔들리면 text/attrs로 재탐색한다", () => {
    document.body.innerHTML = `<div id="root"><button aria-label="추가">추가</button><button aria-label="삭제">삭제</button></div>`;
    const anchor: Anchor = {
      selector: "#root > button:nth-of-type(2)",
      text: "삭제",
      attrs: { "aria-label": "삭제" },
      rect: { x: 0.5, y: 0.1, w: 0.1, h: 0.05 },
    };

    document.querySelectorAll("button")[0]!.remove();
    const result = resolveAnchor(anchor, document);
    expect(result.mode).toBe("refind");
    expect(result.el?.getAttribute("aria-label")).toBe("삭제");
  });

  it("text·attrs 없이 실패하면 rect fallback으로 남긴다", () => {
    const anchor: Anchor = {
      selector: "#missing",
      rect: { x: 0.1, y: 0.2, w: 0.1, h: 0.1 },
    };
    const result = resolveAnchor(anchor, document);
    expect(result.mode).toBe("rect-fallback");
    expect(result.el).toBeNull();
  });
});

describe("프로세스 흐름도 (T28, output-standard §2 섹션 2)", () => {
  /** 로그인(0) → 홈(1) → 완료(2) 체인 + 로그인→오류 분기 프로젝트 */
  function flowProject(): SpecProject {
    return project({
      sceneCodeSeq: 5,
      scenes: [scene("scn_1", 0), scene("scn_2", 1), scene("scn_3", 2), scene("scn_4", 3)],
      annotations: [
        annotation({ id: "ann_1", sceneId: "scn_1", transition: { toSceneId: "scn_2", condition: "성공 시" } }),
        annotation({ id: "ann_2", sceneId: "scn_2", number: 2, transition: { toSceneId: "scn_3" } }),
        annotation({ id: "ann_3", sceneId: "scn_1", number: 3, transition: { toSceneId: "scn_4", condition: "실패" } }),
      ],
    });
  }

  it("간선 정리: 병렬 전이는 라벨을 합치고, 자기 자신·dangling 전이는 그리지 않는다", () => {
    const p = project({
      scenes: [scene("scn_1", 0), scene("scn_2", 1)],
      annotations: [
        annotation({ id: "ann_1", transition: { toSceneId: "scn_2", condition: "성공 시" } }),
        annotation({ id: "ann_2", number: 2, transition: { toSceneId: "scn_2", condition: "재시도" } }),
        annotation({ id: "ann_3", number: 3, transition: { toSceneId: "scn_1" } }),          // 자기 자신
        annotation({ id: "ann_4", number: 4, transition: { toSceneId: "scn_gone" } }),        // dangling
        annotation({ id: "ann_5", number: 5 }),                                              // 전이 없음
      ],
    });
    expect(buildFlowEdges(p)).toEqual([{ from: "scn_1", to: "scn_2", label: "성공 시 / 재시도" }]);
  });

  it("계층 배치: 체인은 왼→오 계층, 분기는 같은 계층에 세로로 쌓인다", () => {
    const p = flowProject();
    const nodes = buildFlowNodes(p, buildFlowEdges(p));
    const byId = new Map(nodes.map((n) => [n.sceneId, n]));
    expect(byId.get("scn_1")?.layer).toBe(0);
    expect(byId.get("scn_2")?.layer).toBe(1);
    expect(byId.get("scn_3")?.layer).toBe(2);
    expect(byId.get("scn_4")?.layer).toBe(1); // scn_2와 같은 계층, 다음 행
    expect(byId.get("scn_4")?.row).toBe(1);
    expect(byId.get("scn_1")?.label).toBe("SCR-001 scn_1");
  });

  it("순환(A→B→A)이 있어도 멈추지 않고 결정론적으로 배치한다", () => {
    const p = project({
      scenes: [scene("scn_1", 0), scene("scn_2", 1)],
      annotations: [
        annotation({ id: "ann_1", transition: { toSceneId: "scn_2" } }),
        annotation({ id: "ann_2", sceneId: "scn_2", number: 2, transition: { toSceneId: "scn_1" } }),
      ],
    });
    const edges = buildFlowEdges(p);
    expect(edges).toHaveLength(2);
    const nodes = buildFlowNodes(p, edges);
    expect(nodes.find((n) => n.sceneId === "scn_1")?.layer).toBe(0);
    expect(nodes.find((n) => n.sceneId === "scn_2")?.layer).toBe(1); // back 간선은 계층에서 무시
  });

  it("뷰어: 전이가 있으면 흐름도 섹션·전이 링크가 렌더되고, 링크 클릭 시 장면이 전환된다", () => {
    document.body.innerHTML = `<div id="app"></div>`;
    const root = document.getElementById("app")!;
    renderViewer(flowProject(), new Map(), root);

    // 섹션 2 흐름도 — 노드 4개(장면 전부) + 간선 라벨
    const flow = root.querySelector(".ms-flow");
    expect(flow).not.toBeNull();
    expect(flow!.querySelectorAll(".ms-flow-node")).toHaveLength(4);
    const labels = [...flow!.querySelectorAll(".ms-flow-label")].map((el) => el.textContent);
    expect(labels).toContain("성공 시");

    // 전이 링크: 현재 장면(scn_1)의 어노테이션 1·3에 링크 2개
    const links = [...root.querySelectorAll<HTMLButtonElement>(".ms-transition")];
    expect(links.map((l) => l.textContent)).toEqual([
      "성공 시 → SCR-002 scn_2 보기",
      "실패 → SCR-004 scn_4 보기",
    ]);

    // 링크 클릭 → 해당 장면으로 전환 (스테이지 제목 + 흐름도 노드 하이라이트)
    links[0]!.click();
    expect(root.querySelector(".ms-stage-title")?.textContent).toBe("SCR-002 scn_2");
    expect(root.querySelector(".ms-flow-node.is-active")?.getAttribute("data-scene-id")).toBe("scn_2");
  });

  it("뷰어: 전이가 하나도 없으면 흐름도 섹션을 렌더하지 않는다 (추론으로 채우지 않음)", () => {
    document.body.innerHTML = `<div id="app"></div>`;
    const root = document.getElementById("app")!;
    renderViewer(project({ scenes: [scene("scn_1", 0)], annotations: [annotation()] }), new Map(), root);
    expect(root.querySelector(".ms-flow")).toBeNull();
  });

  it("뷰어: 흐름도 접기 토글 — 접으면 SVG 본문이 사라지고 다시 펼 수 있다", () => {
    document.body.innerHTML = `<div id="app"></div>`;
    const root = document.getElementById("app")!;
    renderViewer(flowProject(), new Map(), root);

    root.querySelector<HTMLButtonElement>(".ms-flow .ms-collapse-btn")!.click();
    expect(root.querySelector(".ms-flow-body")).toBeNull();      // 본문 숨김
    expect(root.querySelector(".ms-flow")).not.toBeNull();       // 헤드는 유지

    root.querySelector<HTMLButtonElement>(".ms-flow .ms-collapse-btn")!.click();
    expect(root.querySelector(".ms-flow-body svg")).not.toBeNull();
  });

  it("뷰어: ownerLabel이 있으면 헤더 메타에 작성자를 표시하고, 없으면 표시하지 않는다 (T29)", () => {
    document.body.innerHTML = `<div id="app"></div>`;
    const root = document.getElementById("app")!;

    renderViewer(project({ ownerLabel: "김기획", scenes: [scene("scn_1", 0)] }), new Map(), root);
    expect(root.querySelector(".ms-meta")?.textContent).toContain("작성자 김기획");

    renderViewer(project({ scenes: [scene("scn_1", 0)] }), new Map(), root);
    expect(root.querySelector(".ms-meta")?.textContent).not.toContain("작성자");
  });
});
