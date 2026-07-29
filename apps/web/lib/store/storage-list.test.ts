import { describe, it, expect } from "vitest";
import { createFakeStorage } from "../test/fake-storage.js";
import { listObjectsRecursive, removeObjectsUnder, sumObjectBytes } from "./storage-list.js";

const PREFIX = "projects/prj_a/mockup";

describe("listObjectsRecursive", () => {
  it("중첩 디렉토리를 재귀로 모두 나열한다", async () => {
    const { db } = createFakeStorage({
      [`${PREFIX}/index.html`]: { size: 100 },
      [`${PREFIX}/js/app.js`]: { size: 200 },
      [`${PREFIX}/js/vendor/lib.js`]: { size: 300 },
      [`${PREFIX}/img/logo.png`]: { size: 400 },
      "projects/prj_a/assets/asset_x": { size: 999 }, // prefix 밖 — 포함되지 않아야 한다
    });

    const objects = await listObjectsRecursive(db, PREFIX);
    expect(objects.map((o) => o.path).sort()).toEqual([
      `${PREFIX}/img/logo.png`,
      `${PREFIX}/index.html`,
      `${PREFIX}/js/app.js`,
      `${PREFIX}/js/vendor/lib.js`,
    ]);
    expect(await sumObjectBytes(db, PREFIX)).toBe(1000);
  });

  it("한 디렉토리에 1000개를 넘어도 페이지네이션으로 전부 가져온다", async () => {
    const objects: Record<string, { size: number }> = {};
    for (let i = 0; i < 1001; i++) {
      objects[`${PREFIX}/f${String(i).padStart(4, "0")}.js`] = { size: 1 };
    }
    const { db } = createFakeStorage(objects);
    expect((await listObjectsRecursive(db, PREFIX)).length).toBe(1001);
    expect(await sumObjectBytes(db, PREFIX)).toBe(1001);
  });

  it("후행 슬래시가 있어도 같은 결과", async () => {
    const { db } = createFakeStorage({ [`${PREFIX}/index.html`]: { size: 1 } });
    expect(await listObjectsRecursive(db, `${PREFIX}/`)).toHaveLength(1);
  });
});

describe("removeObjectsUnder", () => {
  it("중첩 오브젝트까지 지운다 (한 단계만 보지 않는다)", async () => {
    const { db, removed } = createFakeStorage({
      "projects/prj_a/mockup/index.html": { size: 1 },
      "projects/prj_a/mockup/js/app.js": { size: 1 },
      "projects/prj_a/assets/asset_x": { size: 1 },
    });

    await removeObjectsUnder(db, "projects/prj_a");
    expect(removed.sort()).toEqual([
      "projects/prj_a/assets/asset_x",
      "projects/prj_a/mockup/index.html",
      "projects/prj_a/mockup/js/app.js",
    ]);
    expect(await listObjectsRecursive(db, "projects/prj_a")).toEqual([]);
  });
});
