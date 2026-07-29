import { describe, it, expect } from "vitest";
import { injectMockupHtml } from "../inject.js";
import { LIMITS } from "../abuse/limits.js";
import { createFakeStorage, type FakeObject } from "../test/fake-storage.js";
import {
  validateManifestShape,
  validateMockupManifest,
  ManifestValidationError,
  MockupTooLargeError,
} from "./validate.js";
import type { MockupManifest } from "./types.js";

const base: MockupManifest = {
  entries: ["index.html", "a.js"],
  indexPath: "index.html",
  excluded: [],
};

const PID = "prj_abc";
const PREFIX = `projects/${PID}/mockup`;

function injected(body = "<html><head></head><body>hi</body></html>"): string {
  return injectMockupHtml(body, PID);
}

describe("validateManifestShape", () => {
  it("정상 manifest를 통과시킨다", () => {
    expect(() => validateManifestShape(base, "prj_abc")).not.toThrow();
  });

  it("index.html 누락을 거부한다", () => {
    const bad = { ...base, entries: ["a.js"] };
    expect(() => validateManifestShape(bad, "prj_abc")).toThrow(ManifestValidationError);
  });

  it("위험 경로를 거부한다", () => {
    const bad = { ...base, entries: ["../evil.html", "index.html"] };
    expect(() => validateManifestShape(bad, "prj_abc")).toThrow(ManifestValidationError);
  });

  it("파일 수 한도 초과를 MockupTooLargeError로 거부한다 (W8)", () => {
    const entries = ["index.html"];
    for (let i = 0; i < LIMITS.mockupMaxFileCount; i++) entries.push(`f${i}.js`);
    expect(() => validateManifestShape({ ...base, entries }, PID)).toThrow(MockupTooLargeError);
  });
});

describe("validateMockupManifest — Storage 실측 게이트 (W8)", () => {
  it("정상 업로드를 통과시킨다", async () => {
    const { db } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 500, body: injected() },
      [`${PREFIX}/a.js`]: { size: 100 },
    });
    await expect(validateMockupManifest(db, PID, base)).resolves.toBeUndefined();
  });

  it("HTML만 다운로드한다 — 비-HTML 본문은 서버 메모리로 끌어오지 않는다", async () => {
    const { db, downloaded } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 500, body: injected() },
      // body 없음 = download 시 에러. 그래도 통과해야 한다(받지 않으므로).
      [`${PREFIX}/big.png`]: { size: 10 * 1024 * 1024 },
    });
    await expect(
      validateMockupManifest(db, PID, { ...base, entries: ["index.html", "big.png"] }),
    ).resolves.toBeUndefined();
    expect(downloaded).toEqual([`${PREFIX}/index.html`]);
  });

  it("Storage 총 크기가 한도를 넘으면 거부한다", async () => {
    const { db } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 10, body: injected() },
      [`${PREFIX}/huge.bin`]: { size: LIMITS.mockupMaxTotalBytes },
    });
    await expect(
      validateMockupManifest(db, PID, { ...base, entries: ["index.html", "huge.bin"] }),
    ).rejects.toThrow(MockupTooLargeError);
  });

  it("manifest에 없는 오브젝트까지 합산한다 — manifest만 줄여 한도를 우회할 수 없다", async () => {
    const { db } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 10, body: injected() },
      [`${PREFIX}/hidden/huge.bin`]: { size: LIMITS.mockupMaxTotalBytes },
    });
    await expect(
      validateMockupManifest(db, PID, { ...base, entries: ["index.html"] }),
    ).rejects.toThrow(MockupTooLargeError);
  });

  it("Storage에 없는 엔트리를 거부한다", async () => {
    const { db } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 10, body: injected() },
    });
    await expect(validateMockupManifest(db, PID, base)).rejects.toThrow(ManifestValidationError);
  });

  it("중첩 경로 엔트리를 정상 인식한다", async () => {
    const { db } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 10, body: injected() },
      [`${PREFIX}/js/app.js`]: { size: 10 },
      [`${PREFIX}/sub/page.html`]: { size: 10, body: injected("<body>sub</body>") },
    });
    await expect(
      validateMockupManifest(db, PID, {
        ...base,
        entries: ["index.html", "js/app.js", "sub/page.html"],
      }),
    ).resolves.toBeUndefined();
  });

  it("주입되지 않은 HTML을 거부한다", async () => {
    const objects: Record<string, FakeObject> = {
      [`${PREFIX}/index.html`]: { size: 10, body: injected() },
      [`${PREFIX}/raw.html`]: { size: 10, body: "<html><body>주입 없음</body></html>" },
    };
    const { db } = createFakeStorage(objects);
    await expect(
      validateMockupManifest(db, PID, { ...base, entries: ["index.html", "raw.html"] }),
    ).rejects.toThrow(/raw\.html/);
  });
});
