import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractZipBuffer, ZipSlipError, isSafeMockupPath } from "./extract.js";

async function zipOf(entries: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [p, content] of Object.entries(entries)) zip.file(p, content);
  const buf = await zip.generateAsync({ type: "uint8array" });
  return buf;
}

describe("extractZipBuffer", () => {
  it("정상 엔트리를 메모리에 담는다", async () => {
    const buf = await zipOf({ "index.html": "<html></html>", "app/main.js": "1" });
    const { files, result } = await extractZipBuffer(buf);
    expect(result.fileCount).toBe(2);
    expect(new TextDecoder().decode(files.get("index.html")!)).toContain("html");
    expect(new TextDecoder().decode(files.get("app/main.js")!)).toBe("1");
  });

  it("제외 규칙에 걸리는 엔트리는 건너뛴다", async () => {
    const buf = await zipOf({
      "index.html": "x",
      "node_modules/react/index.js": "y",
      "app.js.map": "m",
    });
    const { files, result } = await extractZipBuffer(buf);
    expect(files.size).toBe(1);
    expect(result.excluded.find((e) => e.pattern === "node_modules/")?.count).toBe(1);
  });

  it("zip-slip 경로는 ZipSlipError로 거부한다", async () => {
    const buf = await zipOf({ "../evil.txt": "pwned" });
    await expect(extractZipBuffer(buf)).rejects.toBeInstanceOf(ZipSlipError);
  });

  it("공통 최상위 폴더를 벗긴다", async () => {
    const buf = await zipOf({ "dist/index.html": "x", "dist/a.js": "y" });
    const { files, result } = await extractZipBuffer(buf);
    expect(result.strippedRoot).toBe("dist");
    expect(files.has("index.html")).toBe(true);
  });
});

describe("isSafeMockupPath", () => {
  it("안전한 상대 경로만 허용한다", () => {
    expect(isSafeMockupPath("index.html")).toBe(true);
    expect(isSafeMockupPath("assets/app.js")).toBe(true);
    expect(isSafeMockupPath("../x")).toBe(false);
    expect(isSafeMockupPath("/abs")).toBe(false);
  });
});
