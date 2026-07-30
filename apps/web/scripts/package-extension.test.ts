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
    await writeFile(path.join(sourceDir, file), content);
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

  it("불완전한 빌드 산출물은 배포하지 않는다", async () => {
    const { sourceDir, outputA } = await createBuiltExtension();
    await rm(path.join(sourceDir, "sdk.js"));

    await expect(packageExtension({ sourceDir, outputFile: outputA })).rejects.toThrow(
      "필수 파일 누락: sdk.js",
    );
  });
});
