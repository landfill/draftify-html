// dist/ → fixtures/todo-app.zip (ID-12 — `npm run fixtures:zip`)
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const distDir = path.join(pkgRoot, "dist");
const outFile = path.join(pkgRoot, "..", "todo-app.zip");

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
