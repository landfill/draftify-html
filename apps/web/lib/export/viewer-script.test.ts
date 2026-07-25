import { describe, it, expect } from "vitest";
import type { SpecProject } from "@mockspec/shared";
import { createFakeStorage } from "../test/fake-storage.js";
import { assembleExportHtml } from "./build-export.js";
import { VIEWER_SCRIPT } from "./viewer-script.js";

/**
 * 회귀 방지: 뷰어 런타임을 **런타임 fs로 읽지 않고 빌드 시점에 인라인**한다는 계약.
 * 이전에는 packages/server의 readViewerScript()(fs.readFile(new URL(..., import.meta.url)))를
 * 태워 Next 런타임에서 ERR_INVALID_ARG_TYPE으로 export·/sample이 500이었다.
 */
describe("VIEWER_SCRIPT", () => {
  it("뷰어 번들이 실제로 인라인돼 있다", () => {
    expect(VIEWER_SCRIPT.length).toBeGreaterThan(5_000);
    expect(VIEWER_SCRIPT).toContain("spec-data"); // 뷰어가 읽는 인라인 spec 슬롯
  });

  it("sourceMappingURL 주석을 남기지 않는다 (file:// 산출물에서 404 유발)", () => {
    expect(VIEWER_SCRIPT).not.toContain("sourceMappingURL");
  });
});

const PID = "prj_export01";

function specWithScene(assetKey: string): SpecProject {
  const now = "2026-07-25T00:00:00.000Z";
  return {
    version: 1,
    id: PID,
    name: "export 검증",
    createdAt: now,
    updatedAt: now,
    mockupSource: { type: "upload", originalFilename: "m.zip", uploadedAt: now },
    sceneCodeSeq: 2,
    scenes: [
      {
        id: "scn_a",
        code: "SCR-001",
        title: "주문 목록",
        route: "/orders",
        order: 0,
        annoNumberSeq: 1,
        snapshotAsset: assetKey,
      },
    ],
    annotations: [],
  };
}

describe("assembleExportHtml", () => {
  it("스냅샷을 base64로 심고 뷰어를 인라인한 단독 HTML을 만든다", async () => {
    const assetKey = "asset_abc123";
    const { db } = createFakeStorage({
      [`projects/${PID}/assets/${assetKey}`]: {
        size: 40,
        body: "<html><body><h1>주문 목록</h1></body></html>",
      },
    });

    const { html, usedMasked } = await assembleExportHtml(db, specWithScene(assetKey));

    expect(usedMasked).toBe(false);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(`data-snapshot="scn_a"`);
    expect(html).toContain(VIEWER_SCRIPT.slice(0, 200));
    // 외부 리소스를 참조하지 않는다(제1원칙 4 — file://에서 네트워크 0건).
    const refs = [...html.matchAll(/(?:src|href)="([^"]*)"/g)].map((m) => m[1]!);
    expect(refs.filter((r) => !r.startsWith("#") && !r.startsWith("data:"))).toEqual([]);
  });

  it("마스킹본이 있으면 그것을 쓴다", async () => {
    const spec = specWithScene("asset_plain");
    spec.scenes[0]!.maskedSnapshotAsset = "asset_masked";
    const { db } = createFakeStorage({
      [`projects/${PID}/assets/asset_plain`]: { size: 10, body: "<html>원본</html>" },
      [`projects/${PID}/assets/asset_masked`]: { size: 10, body: "<html>마스킹</html>" },
    });

    const { html, usedMasked } = await assembleExportHtml(db, spec);
    expect(usedMasked).toBe(true);
    expect(html).toContain(`data-asset="asset_masked"`);
    expect(html).not.toContain(`data-asset="asset_plain"`);
  });
});
