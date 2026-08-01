import { describe, it, expect } from "vitest";
import { formatDate } from "./format.js";

/*
  이 테스트의 요점은 "형식이 예쁜가"가 아니라 **실행 환경의 타임존과 무관하게 같은 문자열이
  나오는가**다 (PR #84 Codex 지적). 콘솔 목록이 서버에서 실려 오면서(#81) 같은 값이 SSR과
  브라우저에서 각각 포맷되는데, 둘의 기본 타임존이 다르면 React 하이드레이션이 깨진다.

  그래서 **날짜 경계를 넘는 값**을 골라 고정한다 — UTC 기준으로는 하루 전이 되는 시각들이다.
  타임존 고정이 풀리면 CI(보통 UTC)에서 바로 실패한다.
*/
describe("formatDate — 표시 타임존 고정 (Asia/Seoul)", () => {
  it("UTC로는 전날인 시각도 KST 날짜로 포맷한다", () => {
    // 16:00Z = KST 익일 01:00 → UTC 기준이면 "8. 1."이 되어 갈린다.
    expect(formatDate("2026-08-01T16:00:00Z")).toBe("2026. 8. 2.");
    // 자정 직전(23:59:59Z)도 KST로는 이미 다음 날 오전이다.
    expect(formatDate("2026-12-31T23:59:59Z")).toBe("2027. 1. 1.");
  });

  it("KST 자정 직후·직전이 서로 다른 날짜로 갈린다", () => {
    expect(formatDate("2026-08-01T14:59:59Z")).toBe("2026. 8. 1."); // KST 23:59:59
    expect(formatDate("2026-08-01T15:00:00Z")).toBe("2026. 8. 2."); // KST 00:00:00
  });

  it("파싱할 수 없는 값은 원문을 그대로 돌려준다", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate("")).toBe("");
  });
});
