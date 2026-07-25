import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { assertInjectedHtml } from "../inject.js";
import { LIMITS } from "../abuse/limits.js";
import {
  IntakeLimitError,
  assertExtractedWithinLimits,
  assertZipWithinLimits,
  prepareZipIntake,
} from "./process.js";

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

  it("zip 원본이 한도를 넘으면 해제 전에 거부한다 (W8)", async () => {
    const oversized = new Uint8Array(LIMITS.zipMaxBytes + 1);
    await expect(prepareZipIntake(oversized, "prj_x")).rejects.toThrow(IntakeLimitError);
  });

  it("해제 후 총 크기가 한도를 넘으면 거부한다 — zip bomb 조기 실패", async () => {
    // 압축이 잘 되는 반복 문자열이라 zip 자체는 작지만 해제하면 한도를 넘는다.
    const big = "A".repeat(LIMITS.mockupMaxTotalBytes + 1);
    const buf = await zipOf({ "index.html": "<html><body>hi</body></html>", "bomb.txt": big });
    await expect(prepareZipIntake(buf, "prj_x")).rejects.toThrow(IntakeLimitError);
  });
});

describe("클라이언트 게이트 단위 (W8)", () => {
  it("zip 크기 한도 경계", () => {
    expect(() => assertZipWithinLimits(LIMITS.zipMaxBytes)).not.toThrow();
    expect(() => assertZipWithinLimits(LIMITS.zipMaxBytes + 1)).toThrow(IntakeLimitError);
  });

  it("파일 수 한도 초과", () => {
    const files = new Map<string, Uint8Array>();
    for (let i = 0; i <= LIMITS.mockupMaxFileCount; i++) {
      files.set(`f${i}.js`, new Uint8Array(1));
    }
    expect(() => assertExtractedWithinLimits(files)).toThrow(/파일 수/);
  });

  it("해제 총 크기 한도 초과", () => {
    const files = new Map<string, Uint8Array>([
      ["a.bin", new Uint8Array(LIMITS.mockupMaxTotalBytes)],
      ["b.bin", new Uint8Array(1)],
    ]);
    expect(() => assertExtractedWithinLimits(files)).toThrow(/총 크기/);
  });
});
