// dist/ → fixtures/todo-app.zip (ID-12 — `npm run fixtures:zip`)
//
// `--variant relative`를 주면 dist-relative/ 를 fixtures/todo-app-relative.zip 으로 묶는다.
// 두 변형이 필요한 이유:
//  - 루트 base(`/assets/...`): 사내판은 프로젝트별 **서브도메인** 서빙이라 절대 경로가 그대로 동작한다(ID-12).
//  - 상대 base(`./assets/...`): 공개판은 `/m/{id}/` **경로 접두** 서빙이라 절대 경로가 접두 밖으로
//    나가 깨진다(킥오프 §7.1 알려진 제약). 공개 서비스 DoD(W9)는 이 변형을 쓴다.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const variantIndex = process.argv.indexOf("--variant");
const variant = variantIndex > 0 ? process.argv[variantIndex + 1] : null;

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(pkgRoot, variant === "relative" ? "dist-relative" : "dist");
const outFile = path.join(
  pkgRoot,
  "..",
  variant === "relative" ? "todo-app-relative.zip" : "todo-app.zip",
);

async function addDir(zip, dir, base) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (entry.isDirectory()) await addDir(zip, abs, base);
    else zip.file(rel, await fs.readFile(abs));
  }
}

const zip = new JSZip();
await addDir(zip, distDir, distDir);
const buf = await zip.generateAsync({ type: "nodebuffer" });
await fs.writeFile(outFile, buf);
console.log(`fixtures zip: ${outFile} (${buf.byteLength.toLocaleString()}B)`);
