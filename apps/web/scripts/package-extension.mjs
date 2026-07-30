import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

export const EXTENSION_ARCHIVE_ROOT = "mockspec-extension";
export const REQUIRED_EXTENSION_FILES = [
  "background.js",
  "content.js",
  "manifest.json",
  "popup.html",
  "popup.js",
  "sdk.js",
];

const FIXED_ZIP_DATE = new Date("1980-01-01T00:00:00.000Z");
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, absolute)));
    } else if (entry.isFile()) {
      files.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }

  return files.sort();
}

/**
 * Built MV3 files are wrapped in one stable root folder so the extracted folder can be
 * selected directly from chrome://extensions. Fixed timestamps keep the archive reproducible.
 */
export async function packageExtension({ sourceDir, outputFile }) {
  try {
    await access(sourceDir);
  } catch {
    throw new Error(
      `[extension-package] ${sourceDir}가 없습니다 — 먼저 루트 npm run build를 실행하세요.`,
    );
  }

  const files = await collectFiles(sourceDir);
  const missing = REQUIRED_EXTENSION_FILES.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    throw new Error(`[extension-package] 필수 파일 누락: ${missing.join(", ")}`);
  }

  const manifest = JSON.parse(await readFile(path.join(sourceDir, "manifest.json"), "utf8"));
  if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) {
    throw new Error("[extension-package] manifest.version은 major.minor.patch 형식이어야 합니다.");
  }

  const zip = new JSZip();
  for (const relative of files) {
    zip.file(`${EXTENSION_ARCHIVE_ROOT}/${relative}`, await readFile(path.join(sourceDir, relative)), {
      createFolders: false,
      date: FIXED_ZIP_DATE,
    });
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, archive);

  return { bytes: archive.byteLength, files, version: manifest.version };
}

const scriptFile = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === scriptFile.toLowerCase();

if (isMain) {
  const workspaceRoot = path.resolve(path.dirname(scriptFile), "../../..");
  const sourceDir = path.join(workspaceRoot, "packages", "extension", "dist");
  const outputFile = path.join(
    workspaceRoot,
    "apps",
    "web",
    "public",
    "download",
    "mockspec-extension.zip",
  );

  try {
    const result = await packageExtension({ sourceDir, outputFile });
    console.log(
      `[extension-package] v${result.version} · ${result.files.length}개 파일 · ${result.bytes} bytes`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
