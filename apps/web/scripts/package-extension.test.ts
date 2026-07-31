import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import {
  EXTENSION_ARCHIVE_ROOT,
  REQUIRED_EXTENSION_FILES,
  packageExtension,
} from "./package-extension.mjs";
import extensionManifest from "../../../packages/extension/manifest.json";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createBuiltExtension(): Promise<{ outputA: string; outputB: string; sourceDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockspec-extension-package-"));
  tempDirs.push(root);
  const sourceDir = path.join(root, "dist");
  await mkdir(sourceDir);

  for (const file of REQUIRED_EXTENSION_FILES) {
    const content =
      file === "manifest.json"
        ? JSON.stringify({ manifest_version: 3, name: "MockSpec", version: "0.1.0" })
        : `fixture:${file}`;
    const target = path.join(sourceDir, file);
    await mkdir(path.dirname(target), { recursive: true }); // icons/처럼 하위 폴더가 있다
    await writeFile(target, content);
  }

  return {
    sourceDir,
    outputA: path.join(root, "release-a.zip"),
    outputB: path.join(root, "release-b.zip"),
  };
}

describe("packageExtension", () => {
  it("필수 파일을 단일 루트 폴더에 재현 가능한 ZIP으로 묶는다", async () => {
    const { sourceDir, outputA, outputB } = await createBuiltExtension();

    const result = await packageExtension({ sourceDir, outputFile: outputA });
    await packageExtension({ sourceDir, outputFile: outputB });

    expect(result.version).toBe("0.1.0");
    expect(await readFile(outputA)).toEqual(await readFile(outputB));

    const zip = await JSZip.loadAsync(await readFile(outputA));
    expect(Object.keys(zip.files).sort()).toEqual(
      REQUIRED_EXTENSION_FILES.map((file) => `${EXTENSION_ARCHIVE_ROOT}/${file}`).sort(),
    );
    const manifest = JSON.parse(
      await zip.file(`${EXTENSION_ARCHIVE_ROOT}/manifest.json`)!.async("string"),
    );
    expect(manifest.version).toBe("0.1.0");
  });

  it("배포본의 서버 권한을 운영 오리진과 로컬 개발 주소로만 제한한다", () => {
    expect(extensionManifest.host_permissions).toEqual([
      "https://draftify-html.vercel.app/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ]);
  });

  /**
   * 이슈 #68 — manifest에 아이콘을 적어도 그 파일이 ZIP에 들어가지 않으면 Chrome은 기본 퍼즐
   * 아이콘으로 표시하고, 사용자는 툴바에서 확장을 찾지 못해 연결 자체를 시작할 수 없다.
   * 아이콘을 늘리거나 경로를 바꿀 때 배포 필수 목록 갱신을 잊는 것이 그 결함의 재발 경로다.
   */
  it("manifest가 참조하는 아이콘이 배포 필수 목록에 전부 있다 (#68)", () => {
    const referenced = new Set<string>([
      ...Object.values(extensionManifest.icons),
      ...Object.values(extensionManifest.action.default_icon),
    ]);

    expect(referenced.size).toBeGreaterThan(0);
    for (const file of referenced) {
      expect(REQUIRED_EXTENSION_FILES).toContain(file);
    }
  });

  it("불완전한 빌드 산출물은 배포하지 않는다", async () => {
    const { sourceDir, outputA } = await createBuiltExtension();
    await rm(path.join(sourceDir, "sdk.js"));

    await expect(packageExtension({ sourceDir, outputFile: outputA })).rejects.toThrow(
      "필수 파일 누락: sdk.js",
    );
  });
});
