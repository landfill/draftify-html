import { describe, it, expect } from "vitest";
import type { Db } from "../store/ids.js";
import { createFakeStorage } from "../test/fake-storage.js";
import { LIMITS } from "./limits.js";
import { checkAssetSizeQuota, checkMockupSizeQuota, checkProjectCountQuota } from "./quota.js";

/** projects count 질의만 흉내내는 최소 스텁. */
function dbWithProjectCount(count: number): Db {
  return {
    from: () => ({ select: async () => ({ count, error: null }) }),
  } as unknown as Db;
}

describe("checkProjectCountQuota", () => {
  it("한도 미만이면 통과", async () => {
    expect(await checkProjectCountQuota(dbWithProjectCount(LIMITS.maxProjectsPerUser - 1))).toBe(
      null,
    );
  });

  it("한도에 도달하면 메시지를 돌려준다 (다음 생성 차단)", async () => {
    const msg = await checkProjectCountQuota(dbWithProjectCount(LIMITS.maxProjectsPerUser));
    expect(msg).toMatch(new RegExp(`${LIMITS.maxProjectsPerUser}개`));
  });
});

describe("checkMockupSizeQuota", () => {
  it("중첩 디렉토리까지 합산해 판정한다", async () => {
    const { db } = createFakeStorage({
      "projects/prj_a/mockup/index.html": { size: LIMITS.mockupMaxTotalBytes },
      "projects/prj_a/mockup/js/app.js": { size: 1 },
    });
    expect(await checkMockupSizeQuota(db, "prj_a")).toMatch(/목업 총 크기/);
  });

  it("한도 이내면 통과", async () => {
    const { db } = createFakeStorage({
      "projects/prj_a/mockup/index.html": { size: 1024 },
    });
    expect(await checkMockupSizeQuota(db, "prj_a")).toBe(null);
  });
});

describe("checkAssetSizeQuota", () => {
  it("기존 사용량 + 신규 크기로 사전 판정한다", async () => {
    const { db } = createFakeStorage({
      "projects/prj_a/assets/asset_1": { size: LIMITS.assetsMaxTotalBytes - 10 },
    });
    expect(await checkAssetSizeQuota(db, "prj_a", 5)).toBe(null);
    expect(await checkAssetSizeQuota(db, "prj_a", 11)).toMatch(/스냅샷 총 크기/);
  });

  it("목업 오브젝트는 asset 쿼터에 포함하지 않는다", async () => {
    const { db } = createFakeStorage({
      "projects/prj_a/mockup/huge.bin": { size: LIMITS.assetsMaxTotalBytes },
    });
    expect(await checkAssetSizeQuota(db, "prj_a", 1024)).toBe(null);
  });
});
