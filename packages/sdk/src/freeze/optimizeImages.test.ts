// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { optimizeSnapshotImages, type ImageEncoder } from "./optimizeImages.js";

/**
 * 스냅샷 이미지 최적화 유닛 (실사용 13차).
 * 실제 WebP 인코딩(OffscreenCanvas)은 happy-dom에 없어 인코더를 주입한다 —
 * 인코딩 자체는 실 Chromium 스크래치로 검증.
 */

const BIG = "A".repeat(140 * 1024); // ≥ MIN_BYTES(100KB) 보장 (base64 4자=3바이트)
const SMALL = "B".repeat(4 * 1024);

const bigPng = `data:image/png;base64,${BIG}`;
const smallPng = `data:image/png;base64,${SMALL}`;

describe("optimizeSnapshotImages", () => {
  it("큰 이미지는 재인코딩본으로 치환하고, 같은 URI의 중복 등장은 한 번만 인코딩해 전부 치환한다", async () => {
    const encoder = vi.fn<ImageEncoder>(async () => "data:image/webp;base64,tiny");
    const html = `<img src="${bigPng}"><div style="background:url(${bigPng})"></div>`;

    const out = await optimizeSnapshotImages(html, encoder);

    expect(encoder).toHaveBeenCalledTimes(1); // 중복 URI는 1회 인코딩
    expect(out).not.toContain(BIG);
    expect(out.match(/data:image\/webp;base64,tiny/g)).toHaveLength(2); // 두 등장 모두 치환
  });

  it("MIN_BYTES 미만(아이콘류)·GIF·SVG는 건드리지 않는다", async () => {
    const encoder = vi.fn<ImageEncoder>(async () => "data:image/webp;base64,tiny");
    const gif = `data:image/gif;base64,${BIG}`;
    const svg = `data:image/svg+xml;base64,${BIG}`;
    const html = `<img src="${smallPng}"><img src="${gif}"><img src="${svg}">`;

    const out = await optimizeSnapshotImages(html, encoder);

    expect(encoder).not.toHaveBeenCalled();
    expect(out).toBe(html);
  });

  it("인코딩 실패나 이득 없음(결과가 더 큼)이면 원본을 유지한다 — 동결을 깨지 않는다", async () => {
    const failing = vi.fn<ImageEncoder>(async () => {
      throw new Error("디코드 실패");
    });
    const bigger = vi.fn<ImageEncoder>(async () => `data:image/webp;base64,${"C".repeat(200 * 1024)}`);
    const html = `<img src="${bigPng}">`;

    await expect(optimizeSnapshotImages(html, failing)).resolves.toBe(html);
    await expect(optimizeSnapshotImages(html, bigger)).resolves.toBe(html);
  });

  it("이미지 data URI가 없으면 그대로 반환한다", async () => {
    const encoder = vi.fn<ImageEncoder>(async () => null);
    await expect(optimizeSnapshotImages("<p>텍스트뿐</p>", encoder)).resolves.toBe("<p>텍스트뿐</p>");
    expect(encoder).not.toHaveBeenCalled();
  });
});
