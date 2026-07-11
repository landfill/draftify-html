// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FreezeError } from "./verify.js";
import { freezeDocument } from "./freeze.js";

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

  it("single-file 내부 오류(정규식 등)면 CSS 최소화 끈 옵션으로 1회 재시도한다", async () => {
    getPageData
      .mockRejectedValueOnce(new SyntaxError("Invalid regular expression: /^local(/: Unterminated group"))
      .mockResolvedValueOnce({ content: SNAPSHOT });
    expect(await freezeDocument()).toBe(SNAPSHOT);
    expect(getPageData).toHaveBeenCalledTimes(2);
    const secondOpts = getPageData.mock.calls[1]![0] as Record<string, unknown>;
    expect(secondOpts.removeAlternativeFonts).toBe(false);
    expect(secondOpts.removeUnusedFonts).toBe(false);
    expect(secondOpts.blockScripts).toBe(true); // 무해화는 폴백에서도 유지
  });

  it("우리 규칙 위반(<script> 잔존 = FreezeError)은 재시도하지 않고 전파한다", async () => {
    getPageData.mockResolvedValue({ content: WITH_SCRIPT });
    await expect(freezeDocument()).rejects.toBeInstanceOf(FreezeError);
    expect(getPageData).toHaveBeenCalledTimes(1);
  });
});
