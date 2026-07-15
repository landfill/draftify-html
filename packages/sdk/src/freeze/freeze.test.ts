// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { countScripts, FreezeError } from "./verify.js";

/**
 * 캡처 자체(single-file-core 실행)는 실제 브라우저 DOM/네트워크가 필요하므로
 * 실 Chrome 검증으로 확인한다. 여기서는 무해화의 제1 방어선인 <script> 검증기만 단위 검증.
 * (verify.ts는 single-file-core를 로드하지 않아 node/happy-dom에서 그대로 테스트 가능)
 */
describe("countScripts (<script> 0개 강제 — §7.1)", () => {
  it("스크립트 없는 문서는 0", () => {
    expect(countScripts("<!doctype html><html><body><p>hi</p></body></html>")).toBe(0);
  });

  it("일반 스크립트를 센다", () => {
    expect(countScripts("<html><head><script>alert(1)</script></head><body></body></html>")).toBe(1);
  });

  it("src 스크립트와 인라인을 모두 센다", () => {
    const html = `<html><body><script src="a.js"></script><script>x()</script></body></html>`;
    expect(countScripts(html)).toBe(2);
  });

  it("비실행 데이터 스크립트(ld+json)도 0으로 보지 않는다 (엄격)", () => {
    const html = `<html><head><script type="application/ld+json">{}</script></head><body></body></html>`;
    expect(countScripts(html)).toBe(1);
  });

  it("FreezeError는 Error의 하위형", () => {
    expect(new FreezeError("x")).toBeInstanceOf(Error);
    expect(new FreezeError("x").name).toBe("FreezeError");
  });
});
