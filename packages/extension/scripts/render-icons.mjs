import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/**
 * icon.svg → PNG 4종 (이슈 #68). MV3는 아이콘으로 SVG를 받지 않는다.
 *
 * **빌드 파이프라인이 아니라 수동 실행 스크립트다** — 산출 PNG는 저장소에 커밋한다.
 * 아이콘은 좀처럼 바뀌지 않는데, 빌드가 Playwright(브라우저 다운로드 포함)에 의존하면
 * Vercel 빌드까지 그 비용을 매번 낸다. 원본을 고쳤을 때만 다시 돌린다:
 *
 *   node packages/extension/scripts/render-icons.mjs
 */

/**
 * 툴바에 쓰이는 작은 두 크기는 획을 굵히고 픽셀 그리드에 맞춘 별도 소스를 쓴다 —
 * 큰 아이콘을 그대로 축소하면 16px에서 중앙 V가 뭉개진다 (icon-small.svg 주석 참조).
 */
const SIZES = [
  { size: 16, source: "icon-small.svg" },
  { size: 32, source: "icon-small.svg" },
  { size: 48, source: "icon.svg" },
  { size: 128, source: "icon.svg" },
];

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sources = new Map();
async function loadSvg(name) {
  if (!sources.has(name)) sources.set(name, await readFile(path.join(root, "icons", name), "utf8"));
  return sources.get(name);
}

const browser = await chromium.launch();
try {
  for (const { size, source } of SIZES) {
    const svg = await loadSvg(source);
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    // 배경을 투명하게 두고 SVG만 채운다 — 라운드 사각형 모서리 밖이 흰 사각형으로 남지 않게.
    await page.setContent(
      `<!doctype html><style>
         html,body{margin:0;padding:0;background:transparent}
         svg{display:block;width:${size}px;height:${size}px}
       </style>${svg}`,
    );
    const png = await page.screenshot({ omitBackground: true });
    await writeFile(path.join(root, "icons", `icon-${size}.png`), png);
    await page.close();
    console.log(`[extension-icons] icon-${size}.png · ${png.byteLength} bytes · ${source}`);
  }
} finally {
  await browser.close();
}
