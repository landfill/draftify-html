// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FreezeError } from "./verify.js";
import { freezeDocument, neutralizeMedia } from "./freeze.js";

/**
 * 동결 폴백 로직(실사용에서 발견된 single-file 정규식 오류 대응).
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
});
