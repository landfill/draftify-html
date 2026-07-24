import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { assertInjectedHtml } from "../inject.js";
import { prepareZipIntake } from "./process.js";

async function zipOf(entries: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [p, content] of Object.entries(entries)) zip.file(p, content);
  return zip.generateAsync({ type: "uint8array" });
}

describe("prepareZipIntake", () => {
  it("index.html에 SDK·base를 주입한 manifest를 만든다", async () => {
    const buf = await zipOf({
      "index.html": "<html><head></head><body>hi</body></html>",
      "style.css": "body{}",
    });
    const { files, manifest } = await prepareZipIntake(buf, "prj_test01");
    expect(manifest.indexPath).toBe("index.html");
    expect(manifest.entries).toContain("style.css");
    const index = files.find((f) => f.path === "index.html")!;
    const html = new TextDecoder().decode(index.data);
    expect(() => assertInjectedHtml(html, "prj_test01")).not.toThrow();
  });

  it("index.html이 없으면 거부한다", async () => {
    const buf = await zipOf({ "app.js": "1" });
    await expect(prepareZipIntake(buf, "prj_x")).rejects.toThrow(/index\.html/);
  });
});
