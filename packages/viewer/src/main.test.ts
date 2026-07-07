// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import type { Anchor, Annotation, Scene, SpecProject } from "@mockspec/shared";
import {
  annotationsOf,
  decodeBase64Utf8,
  markdownToHtml,
  orderedScenes,
  readEmbeddedSnapshots,
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
