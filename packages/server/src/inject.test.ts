import { describe, it, expect } from "vitest";
import { injectSdkTag } from "./inject.js";

describe("injectSdkTag", () => {
  it("</body> 직전에 data-project를 실은 SDK 태그를 넣는다", () => {
    const out = injectSdkTag("<html><body><h1>Hi</h1></body></html>", "prj_abc123");
    expect(out).toContain('src="/__mockspec/sdk.js"');
    expect(out).toContain('data-project="prj_abc123"');
    expect(out.indexOf("__mockspec/sdk.js")).toBeLessThan(out.indexOf("</body>"));
  });

  it("</body>가 없으면 말미에 부착한다", () => {
    const out = injectSdkTag("<div>no body tag</div>", "prj_x");
    expect(out.endsWith("</script>")).toBe(true);
    expect(out).toContain('data-project="prj_x"');
  });

  it("마지막 </body> 기준으로 삽입한다(중첩 방어)", () => {
    const out = injectSdkTag("<body>a</body><!-- </body> in comment -->", "prj_y");
    // 태그가 정확히 한 번만 삽입됨
    expect(out.match(/__mockspec\/sdk\.js/g)).toHaveLength(1);
  });
});
