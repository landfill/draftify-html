import { describe, it, expect } from "vitest";
import { LIMITS, RATE_LIMITS, formatMb } from "./limits.js";

/**
 * 한도 값은 **제품 계약**이다(킥오프 §7.5 표). 값이 조용히 바뀌면 공개 정책이 바뀌는 것이므로,
 * 문서와 코드가 갈라지지 않게 여기서 못박는다 — 값을 바꾸려면 문서를 먼저 고치고 이 테스트도 함께.
 */
describe("LIMITS — 킥오프 §7.5 계약", () => {
  it("쿼터 값이 문서와 일치한다", () => {
    expect(LIMITS).toEqual({
      maxProjectsPerUser: 20,
      zipMaxBytes: 50 * 1024 * 1024,
      mockupMaxTotalBytes: 50 * 1024 * 1024,
      mockupMaxFileCount: 1500,
      snapshotMaxBytes: 25 * 1024 * 1024,
      assetsMaxTotalBytes: 100 * 1024 * 1024,
    });
  });

  it("레이트리밋 버킷이 문서와 일치한다", () => {
    expect(RATE_LIMITS).toEqual({
      projectCreate: { limit: 20, windowSeconds: 3600 },
      write: { limit: 120, windowSeconds: 60 },
      export: { limit: 30, windowSeconds: 3600 },
      token: { limit: 20, windowSeconds: 3600 },
    });
  });

  it("write 윈도우는 1분이다 — 자동 저장(500ms 디바운스) 폭주를 정상으로 본다", () => {
    expect(RATE_LIMITS.write.windowSeconds).toBe(60);
  });
});

describe("formatMb", () => {
  it("정수는 소수점 없이, 나머지는 한 자리", () => {
    expect(formatMb(50 * 1024 * 1024)).toBe("50MB");
    expect(formatMb(1.5 * 1024 * 1024)).toBe("1.5MB");
  });
});
