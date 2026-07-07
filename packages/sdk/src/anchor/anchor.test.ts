// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import type { Anchor } from "@mockspec/shared";
import { pickTarget, generateSelector, generateAnchor, resolveAnchor } from "./anchor.js";

function setBody(html: string) {
  document.body.innerHTML = html;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("pickTarget (ID-08)", () => {
  it("클릭 지점의 가장 가까운 인터랙티브 조상을 잡는다", () => {
    setBody(`<button id="b"><span id="s">저장</span></button>`);
    const span = document.getElementById("s")!;
    expect(pickTarget(span).id).toBe("b"); // span → button
  });
  it("인터랙티브 조상이 없으면 그 요소 그대로", () => {
    setBody(`<div id="d"><p id="p">text</p></div>`);
    expect(pickTarget(document.getElementById("p")!).id).toBe("p");
  });
});

describe("generateSelector (ID-06)", () => {
  it("유일 id면 #id", () => {
    setBody(`<button id="save">저장</button>`);
    expect(generateSelector(document.getElementById("save")!)).toBe("#save");
  });
  it("유일 id 조상 기준 nth-of-type 체인, 클래스 미사용", () => {
    setBody(`<div id="root"><section><button>A</button><button>B</button></section></div>`);
    const b = document.querySelectorAll("#root button")[1]!;
    const sel = generateSelector(b);
    expect(sel).toBe("#root > section:nth-of-type(1) > button:nth-of-type(2)");
    expect(sel).not.toContain(".");
    expect(document.querySelectorAll(sel)).toHaveLength(1);
  });
  it("id 조상이 없으면 body 기준 전체 경로", () => {
    setBody(`<main><button>X</button></main>`);
    const sel = generateSelector(document.querySelector("button")!);
    expect(sel.startsWith("body >")).toBe(true);
    expect(document.querySelectorAll(sel)).toHaveLength(1);
  });
});

describe("resolveAnchor (ID-07)", () => {
  it("selector로 바로 찾고 시그니처 일치 → mode=selector", () => {
    setBody(`<button id="save">저장</button>`);
    const anchor = generateAnchor(document.getElementById("save")!);
    const r = resolveAnchor(anchor, document);
    expect(r.mode).toBe("selector");
    expect((r.el as HTMLElement).id).toBe("save");
  });

  it("텍스트 변경 후 selector가 흔들려도 text/attrs로 재탐색 성공 + selector 갱신 (AC)", () => {
    // 부착 시점: 두 번째 버튼에 앵커 생성
    setBody(`<div id="root"><button aria-label="추가">추가</button><button aria-label="삭제">삭제</button></div>`);
    const del = document.querySelectorAll("#root button")[1]!;
    const anchor = generateAnchor(del);
    expect(anchor.selector).toContain("nth-of-type(2)");

    // DOM 변형: 앞 버튼이 사라져 위치(nth-of-type)가 바뀜 → selector는 다른 요소를 가리키게 됨
    document.querySelectorAll("#root button")[0]!.remove();
    const r = resolveAnchor(anchor, document);
    expect(r.mode).toBe("refind");                 // selector 실패 → 재탐색
    expect((r.el as HTMLElement).getAttribute("aria-label")).toBe("삭제"); // 올바른 요소
    expect(r.selector).toContain("nth-of-type(1)"); // 갱신된 selector
  });

  it("여러 후보 중 rect 중심 최근접을 고른다", () => {
    setBody(`<button aria-label="같음">동일</button><button aria-label="같음">동일</button>`);
    const first = document.querySelectorAll("button")[0]!;
    const anchor = generateAnchor(first);
    // selector를 깨서 재탐색 경로로 유도
    const broken: Anchor = { ...anchor, selector: "button:nth-of-type(99)" };
    const r = resolveAnchor(broken, document);
    expect(r.mode).toBe("refind");
    expect(r.el).not.toBeNull();
  });

  it("text·attrs 둘 다 없고 selector도 실패하면 rect-fallback (조용히 사라지지 않음)", () => {
    setBody(`<div id="root"><span></span></div>`);
    const anchor: Anchor = { selector: "#root > span:nth-of-type(9)", rect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } };
    const r = resolveAnchor(anchor, document);
    expect(r.mode).toBe("rect-fallback");
    expect(r.el).toBeNull();
  });
});
