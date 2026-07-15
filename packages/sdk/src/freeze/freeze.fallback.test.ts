// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FreezeError } from "./verify.js";
import { freezeDocument, neutralizeDataScripts, neutralizeMedia } from "./freeze.js";

/**
 * 캡처 폴백 로직(실사용에서 발견된 single-file 정규식 오류 대응).
 * getPageData를 목킹해 우리 래퍼의 재시도 규칙만 검증한다 — 실제 single-file 실행은
 * 실 Chrome 검증(스크래치)이 담당.
 */

const getPageData = vi.fn();
vi.mock("single-file-core/single-file.js", () => ({ getPageData: (...args: unknown[]) => getPageData(...args) }));

beforeEach(() => {
  getPageData.mockReset();
});

const SNAPSHOT = "<!doctype html><html><body><p>ok</p></body></html>";
const WITH_SCRIPT = "<html><body><script>x()</script></body></html>";

describe("freezeDocument 폴백 (경로 D 실사용 — single-file 내부 오류 대응)", () => {
  it("1차 성공이면 폴백 없이 그대로 반환한다", async () => {
    getPageData.mockResolvedValueOnce({ content: SNAPSHOT });
    expect(await freezeDocument()).toBe(SNAPSHOT);
    expect(getPageData).toHaveBeenCalledTimes(1);
  });

  it("1차 옵션이 폰트·비디오·오디오를 항상 차단한다 (킥오프 §11 11차 — 크기 절감)", async () => {
    getPageData.mockResolvedValueOnce({ content: SNAPSHOT });
    await freezeDocument();
    const firstOpts = getPageData.mock.calls[0]![0] as Record<string, unknown>;
    expect(firstOpts.blockFonts).toBe(true); // 웹폰트 미임베드 — 시스템 폰트
    expect(firstOpts.blockVideos).toBe(true); // 비디오 콘텐츠 미임베드 — 포스터+링크로 대체
    expect(firstOpts.removeAlternativeFonts).toBe(false); // 폰트 안 쓰므로 무의미 + 크래시 진원
    expect(firstOpts.blockScripts).toBe(true); // 무해화는 그대로
  });

  it("single-file 내부 오류(정규식 등)면 CSS 최소화 끈 옵션으로 1회 재시도한다", async () => {
    getPageData
      .mockRejectedValueOnce(new SyntaxError("Invalid regular expression: /^local(/: Unterminated group"))
      .mockResolvedValueOnce({ content: SNAPSHOT });
    expect(await freezeDocument()).toBe(SNAPSHOT);
    expect(getPageData).toHaveBeenCalledTimes(2);
    const secondOpts = getPageData.mock.calls[1]![0] as Record<string, unknown>;
    expect(secondOpts.removeAlternativeFonts).toBe(false); // 크래시 액션 off
    expect(secondOpts.blockFonts).toBe(true); // 웹폰트 임베드 안 함 — 50MB 초과 방지
    expect(secondOpts.blockScripts).toBe(true); // 무해화는 폴백에서도 유지
  });

  it("우리 규칙 위반(<script> 잔존 = FreezeError)은 재시도하지 않고 전파한다", async () => {
    getPageData.mockResolvedValue({ content: WITH_SCRIPT });
    await expect(freezeDocument()).rejects.toBeInstanceOf(FreezeError);
    expect(getPageData).toHaveBeenCalledTimes(1);
  });
});

describe("neutralizeMedia (킥오프 §11 11차 — 오디오·비디오 포스터 소스 제거)", () => {
  it("audio·video·source의 src/srcset/poster를 떼고, 요소는 남기며, 복원 시 원복한다", () => {
    document.body.innerHTML = `
      <video id="v" src="/clip.mp4" poster="/poster.jpg" width="320"></video>
      <audio id="a" src="/sound.mp3"></audio>
      <video id="v2"><source src="/c.webm" srcset="/c2.webm 2x"></video>`;
    const restore = neutralizeMedia();

    // 로딩 속성은 제거 — single-file이 임베드할 대상이 없다
    expect(document.getElementById("v")!.hasAttribute("src")).toBe(false);
    expect(document.getElementById("v")!.hasAttribute("poster")).toBe(false);
    expect(document.getElementById("a")!.hasAttribute("src")).toBe(false);
    expect(document.querySelector("#v2 source")!.hasAttribute("src")).toBe(false);
    expect(document.querySelector("#v2 source")!.hasAttribute("srcset")).toBe(false);
    // 요소(레이아웃 영역)·비로딩 속성은 유지 — 와이어프레임 자리
    expect(document.getElementById("v")!.getAttribute("width")).toBe("320");
    expect(document.querySelectorAll("video, audio")).toHaveLength(3);

    restore();
    expect(document.getElementById("v")!.getAttribute("src")).toBe("/clip.mp4");
    expect(document.getElementById("v")!.getAttribute("poster")).toBe("/poster.jpg");
    expect(document.getElementById("a")!.getAttribute("src")).toBe("/sound.mp3");
    expect(document.querySelector("#v2 source")!.getAttribute("srcset")).toBe("/c2.webm 2x");
  });

  it("열린 shadow DOM 내부 미디어도 제거·복원한다 (single-file이 open shadow root를 직렬화 — 리뷰 반영)", () => {
    document.body.innerHTML = `<div id="host"></div>`;
    const shadow = document.getElementById("host")!.attachShadow({ mode: "open" });
    shadow.innerHTML = `<video id="sv" src="/shadow.mp4" poster="/sp.jpg"></video>`;

    const restore = neutralizeMedia();
    const sv = shadow.getElementById("sv")!;
    expect(sv.hasAttribute("src")).toBe(false);
    expect(sv.hasAttribute("poster")).toBe(false);
    expect(shadow.querySelectorAll("video")).toHaveLength(1); // 요소는 유지

    restore();
    expect(sv.getAttribute("src")).toBe("/shadow.mp4");
    expect(sv.getAttribute("poster")).toBe("/sp.jpg");
  });

  it("우리 패널(data-mockspec-root)의 shadow DOM은 건드리지 않는다 (캡처에서 통째 제외되므로)", () => {
    document.body.innerHTML = `<div id="panel" data-mockspec-root></div>`;
    const shadow = document.getElementById("panel")!.attachShadow({ mode: "open" });
    shadow.innerHTML = `<audio id="pa" src="/panel.mp3"></audio>`;

    const restore = neutralizeMedia();
    expect(shadow.getElementById("pa")!.getAttribute("src")).toBe("/panel.mp3"); // 손대지 않음
    restore();
  });
});

describe("neutralizeDataScripts (비실행 데이터 <script> 제거 — m.hanatour.com ld+json 실사용)", () => {
  it("데이터 script(ld+json 등)는 떼고, 실행 script는 남기며(blockScripts 담당), 복원 시 원위치", () => {
    document.head.innerHTML = `
      <script type="application/ld+json" id="ld">{"@context":"https://schema.org"}</script>
      <meta id="after-ld" name="x" content="y">`;
    document.body.innerHTML = `
      <script id="js1">x()</script>
      <script id="js2" type="text/javascript">y()</script>
      <script id="mod" type="module">z()</script>
      <script id="tpl" type="text/x-template"><p>tpl</p></script>`;
    const restore = neutralizeDataScripts();

    expect(document.getElementById("ld")).toBeNull();
    expect(document.getElementById("tpl")).toBeNull();
    // 실행 계열은 single-file blockScripts가 제거하므로 여기서는 손대지 않는다
    expect(document.getElementById("js1")).not.toBeNull();
    expect(document.getElementById("js2")).not.toBeNull();
    expect(document.getElementById("mod")).not.toBeNull();

    restore();
    const ld = document.getElementById("ld")!;
    expect(ld.textContent).toContain("schema.org");
    // 원위치 복원 — 떼기 전의 nextSibling(meta) 앞으로 돌아온다
    expect(ld.nextElementSibling?.id).toBe("after-ld");
  });

  it("인접한 데이터 script 여러 개도 순서 그대로 복원한다", () => {
    document.body.innerHTML = `
      <script type="application/json" id="d1">1</script>
      <script type="application/ld+json" id="d2">2</script>
      <p id="p">본문</p>`;
    const restore = neutralizeDataScripts();
    expect(document.querySelectorAll("script")).toHaveLength(0);

    restore();
    const ids = Array.from(document.body.children).map((el) => el.id);
    expect(ids).toEqual(["d1", "d2", "p"]);
  });

  it("열린 shadow DOM 내부 데이터 script도 제거·복원하고, 패널(data-mockspec-root)은 건너뛴다", () => {
    document.body.innerHTML = `<div id="host"></div><div id="panel" data-mockspec-root></div>`;
    const shadow = document.getElementById("host")!.attachShadow({ mode: "open" });
    shadow.innerHTML = `<script type="application/ld+json" id="sd">{}</script><p>내용</p>`;
    const panelShadow = document.getElementById("panel")!.attachShadow({ mode: "open" });
    panelShadow.innerHTML = `<script type="application/json" id="pd">{}</script>`;

    const restore = neutralizeDataScripts();
    expect(shadow.getElementById("sd")).toBeNull();
    expect(panelShadow.getElementById("pd")).not.toBeNull(); // 패널은 손대지 않음

    restore();
    expect(shadow.getElementById("sd")).not.toBeNull();
  });

  it("복원 기준 노드(nextSibling)가 캡처 중 사라져도 예외 없이 부모 끝에 복원한다 (라이브 페이지 DOM 변동 — 리뷰 반영)", () => {
    document.body.innerHTML = `
      <script type="application/ld+json" id="ld">{}</script>
      <div id="gone">캡처 중 페이지가 지울 노드</div>
      <p id="stay">본문</p>`;
    const restore = neutralizeDataScripts();
    document.getElementById("gone")!.remove(); // 라이브 페이지의 자체 DOM 변동 시뮬레이션

    expect(restore).not.toThrow();
    const ld = document.getElementById("ld")!;
    expect(ld).not.toBeNull();
    expect(ld.parentNode).toBe(document.body); // 기준을 잃었으면 부모 끝으로
  });
});
