import { build } from "vite";
import { cp, mkdir, rm, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * [S2.5] 확장 빌드 조립.
 * MV3 content script·popup·background는 ES 모듈이 아니라 클래식 스크립트여야 해서
 * 엔트리별 vite lib(IIFE) 빌드로 각각 단일 파일을 만든다 (sdk 빌드와 동일 방식, 신규 번들러 없음).
 * 이후 manifest·popup.html과 기존 sdk.js 번들(../sdk/dist — 재사용, 재빌드 아님)을 dist/에 복사.
 * dist/를 chrome://extensions "압축해제된 확장 프로그램 로드"로 지정하면 된다.
 */

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const sdkBundle = path.join(root, "..", "sdk", "dist", "sdk.js");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ["content", "popup", "background"]) {
  await build({
    root,
    configFile: false,
    logLevel: "warn",
    build: {
      lib: {
        entry: path.join(root, "src", `${entry}.ts`),
        name: `mockspec_${entry}`,
        formats: ["iife"],
        fileName: () => `${entry}.js`,
      },
      outDir: dist,
      emptyOutDir: false,
      sourcemap: false,
      target: "es2022",
    },
  });
}

try {
  await access(sdkBundle);
} catch {
  console.error("[extension] ../sdk/dist/sdk.js가 없습니다 — 먼저 sdk를 빌드하세요 (npm run build -w @mockspec/sdk).");
  process.exit(1);
}

await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
await cp(path.join(root, "popup.html"), path.join(dist, "popup.html"));
await cp(sdkBundle, path.join(dist, "sdk.js"));

console.log(`[extension] dist 조립 완료: ${dist}`);
