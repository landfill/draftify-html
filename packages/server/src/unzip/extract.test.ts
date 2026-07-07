import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import JSZip from "jszip";
import { extractZip, ZipSlipError } from "./extract.js";

async function zipOf(entries: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [p, content] of Object.entries(entries)) zip.file(p, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

let dest: string;
beforeEach(async () => {
  dest = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-extract-"));
});
afterEach(async () => {
  await fs.rm(dest, { recursive: true, force: true });
});

describe("extractZip", () => {
  it("정상 엔트리를 디스크에 쓰고 개수를 센다", async () => {
    const buf = await zipOf({ "index.html": "<html></html>", "app/main.js": "1" });
    const result = await extractZip(buf, dest);
    expect(result.fileCount).toBe(2);
    expect(await fs.readFile(path.join(dest, "index.html"), "utf8")).toContain("html");
    expect(await fs.readFile(path.join(dest, "app/main.js"), "utf8")).toBe("1");
  });

  it("제외 규칙에 걸리는 엔트리는 쓰지 않고 집계한다", async () => {
    const buf = await zipOf({
      "index.html": "x",
      "node_modules/react/index.js": "y",
      "node_modules/lodash/x.js": "z",
      ".git/config": "g",
      "src/.DS_Store": "d",
      "app.js.map": "m",
    });
    const result = await extractZip(buf, dest);
    expect(result.fileCount).toBe(1); // index.html만
    const byPattern = Object.fromEntries(result.excluded.map((e) => [e.pattern, e.count]));
    expect(byPattern["node_modules/"]).toBe(2);
    expect(byPattern[".git/"]).toBe(1);
    expect(byPattern[".DS_Store"]).toBe(1);
    expect(byPattern["*.map"]).toBe(1);
    // 실제로 디스크에 없어야 함
    await expect(fs.access(path.join(dest, "node_modules"))).rejects.toThrow();
  });

  it("zip-slip 경로는 ZipSlipError로 거부한다", async () => {
    const buf = await zipOf({ "../evil.txt": "pwned" });
    await expect(extractZip(buf, dest)).rejects.toBeInstanceOf(ZipSlipError);
    // 디렉토리 밖에 파일이 생기지 않았는지
    await expect(fs.access(path.join(path.dirname(dest), "evil.txt"))).rejects.toThrow();
  });

  it("깊은 zip-slip(중첩 ../)도 거부한다", async () => {
    const buf = await zipOf({ "a/b/../../../escape.txt": "x" });
    await expect(extractZip(buf, dest)).rejects.toBeInstanceOf(ZipSlipError);
  });
});
