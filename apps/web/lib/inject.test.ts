import { describe, it, expect } from "vitest";
import { injectSdkTag, setBaseHref, injectMockupHtml, assertInjectedHtml } from "./inject.js";

describe("injectSdkTag", () => {
  it("</body> 직전에 data-project를 실은 SDK 태그를 넣는다", () => {
    const out = injectSdkTag("<html><body><h1>Hi</h1></body></html>", "prj_abc123");
    expect(out).toContain('src="/__mockspec/sdk.js"');
    expect(out).toContain('data-project="prj_abc123"');
    expect(out.indexOf("__mockspec/sdk.js")).toBeLessThan(out.indexOf("</body>"));
  });
});

describe("setBaseHref", () => {
  it("기존 base를 교체한다", () => {
    const out = setBaseHref('<html><head><base href="/"></head></html>', "prj_x");
    expect(out.match(/<base\s[^>]*>/gi)).toHaveLength(1);
    expect(out).toContain('href="/m/prj_x/"');
    expect(out).not.toContain('href="/"');
  });

  it("base가 없으면 head 안에 삽입한다", () => {
    const out = setBaseHref("<html><head></head><body></body></html>", "prj_y");
    expect(out).toContain('<base href="/m/prj_y/">');
  });
});

describe("injectMockupHtml", () => {
  it("SDK·base를 모두 적용하고 검증을 통과한다", () => {
    const html = "<html><head></head><body>ok</body></html>";
    const out = injectMockupHtml(html, "prj_z");
    expect(() => assertInjectedHtml(out, "prj_z")).not.toThrow();
  });
});
