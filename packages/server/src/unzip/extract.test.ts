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

describe("extractZip 최상위 폴더 언랩 (킥오프 §11 3차 개정)", () => {
  it("모든 엔트리가 한 폴더 아래면 벗겨서 루트로 승격한다", async () => {
    const buf = await zipOf({ "dist/index.html": "<html></html>", "dist/assets/app.js": "1" });
    const result = await extractZip(buf, dest);
    expect(result.strippedRoot).toBe("dist");
    expect(await fs.readFile(path.join(dest, "index.html"), "utf8")).toContain("html");
    expect(await fs.readFile(path.join(dest, "assets/app.js"), "utf8")).toBe("1");
  });

  it("중첩된 공통 접두(project/dist)도 전부 벗긴다", async () => {
    const buf = await zipOf({ "project/dist/index.html": "x", "project/dist/a.js": "y" });
    const result = await extractZip(buf, dest);
    expect(result.strippedRoot).toBe("project/dist");
    await expect(fs.access(path.join(dest, "index.html"))).resolves.toBeUndefined();
  });

  it("루트에 파일이 있으면 언랩하지 않는다", async () => {
    const buf = await zipOf({ "index.html": "x", "assets/app.js": "y" });
    const result = await extractZip(buf, dest);
    expect(result.strippedRoot).toBeUndefined();
    await expect(fs.access(path.join(dest, "assets/app.js"))).resolves.toBeUndefined();
  });

  it("제외 대상만 루트에 있으면 나머지 공통 폴더를 벗긴다", async () => {
    const buf = await zipOf({ "dist/index.html": "x", ".DS_Store": "junk" });
    const result = await extractZip(buf, dest);
    expect(result.strippedRoot).toBe("dist");
    await expect(fs.access(path.join(dest, "index.html"))).resolves.toBeUndefined();
  });

  it("단일 파일 zip은 언랩 없이 그대로 푼다 (파일명은 접두가 아니다)", async () => {
    const buf = await zipOf({ "index.html": "x" });
    const result = await extractZip(buf, dest);
    expect(result.strippedRoot).toBeUndefined();
    await expect(fs.access(path.join(dest, "index.html"))).resolves.toBeUndefined();
  });

  it("언랩으로 zip-slip 검증을 우회할 수 없다 (.. 세그먼트는 접두 불가)", async () => {
    const buf = await zipOf({ "../evil.txt": "pwned", "../evil2.txt": "pwned" });
    await expect(extractZip(buf, dest)).rejects.toBeInstanceOf(ZipSlipError);
    await expect(fs.access(path.join(path.dirname(dest), "evil.txt"))).rejects.toThrow();
  });
});
