import fs from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import type { SpecProject } from "@mockspec/shared";
import { readAsset, readSpec } from "../store/projectStore.js";
import { appendExportRecord } from "../store/exportStore.js";
import { sendError } from "../errors.js";

const EXPORT_SIZE_WARNING_BYTES = 50 * 1024 * 1024;

const VIEWER_CSS = `
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #202124;
  background: #f7f8f9;
}
* { box-sizing: border-box; }
body { margin: 0; background: #f7f8f9; }
button, input, textarea { font: inherit; }
/* 헤더·(선택)흐름도·본문 3단 — 흐름도 섹션이 없어도 본문이 남은 높이를 채우도록 flex.
   셸을 뷰포트 높이에 고정해 페이지 세로 스크롤을 없앤다 — 헤더·화면 목록·어노테이션
   패널은 항상 보이고, 세로 스크롤은 3컬럼 각자 내부에서 일어난다 (긴 스냅샷은 중앙만 스크롤) */
.ms-shell { height: 100vh; display: flex; flex-direction: column; }
.ms-layout { flex: 1; }
.ms-header {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; background: #fff; border-bottom: 1px solid #dfe3e7;
}
.ms-title { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; }
.ms-meta { color: #5f6368; font-size: 13px; white-space: nowrap; }
/* 행을 minmax(0,1fr)로 고정 — auto 행은 콘텐츠 높이로 커져 셸을 넘치므로 내부 스크롤이 안 생긴다 */
.ms-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr) 300px; grid-template-rows: minmax(0, 1fr); min-height: 0; }
.ms-layout--collapsed { grid-template-columns: 40px minmax(0, 1fr) 300px; }
.ms-sidebar, .ms-panel {
  background: #fff; border-right: 1px solid #dfe3e7; overflow: auto; min-width: 0;
}
.ms-sidebar-head { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-right: 8px; }
.ms-sidebar-head .ms-section-title { padding-bottom: 0; }
.ms-sidebar--collapsed { display: flex; justify-content: center; padding-top: 10px; overflow: hidden; }
.ms-collapse-btn {
  border: 1px solid #dfe3e7; background: #fff; border-radius: 6px; cursor: pointer;
  color: #5f6368; font-size: 14px; line-height: 1; padding: 4px 8px;
}
.ms-collapse-btn:hover { background: #f1f3f4; color: #202124; }
.ms-panel { border-right: 0; border-left: 1px solid #dfe3e7; }
.ms-section-title { padding: 12px 14px 8px; font-size: 12px; font-weight: 700; color: #5f6368; text-transform: uppercase; letter-spacing: .04em; }
.ms-scene-button {
  display: block; width: calc(100% - 16px); margin: 0 8px 6px; padding: 10px 10px;
  text-align: left; border: 1px solid transparent; border-radius: 8px; background: transparent; color: #202124; cursor: pointer;
}
.ms-scene-button:hover { background: #f1f3f4; }
.ms-scene-button.is-active { border-color: #1a73e8; background: #e8f0fe; }
.ms-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #1a73e8; font-size: 12px; font-weight: 700; }
.ms-scene-title { display: block; margin-top: 2px; overflow-wrap: anywhere; }
.ms-main { min-width: 0; overflow: auto; padding: 16px; }
/* 넓은 캡처는 .ms-main이 양방향 스크롤 — 스테이지는 콘텐츠 너비로 커진다 (JS가 iframe 너비 지정) */
.ms-stage-header { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 12px; }
.ms-stage-title { margin: 0; font-size: 16px; line-height: 1.4; }
.ms-note { margin: 6px 0 0; color: #5f6368; font-size: 13px; }
.ms-stage-wrap {
  position: relative; min-height: 480px; background: #fff; border: 1px solid #dfe3e7;
  border-radius: 8px; overflow: hidden; width: max-content; max-width: none;
}
.ms-frame { display: block; width: 100%; min-height: 480px; border: 0; background: #fff; }
.ms-marker-layer { position: absolute; inset: 0; pointer-events: none; }
.ms-marker {
  position: absolute; width: 28px; height: 28px; transform: translate(-50%, -50%);
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  border: 2px solid #fff; background: #1a73e8; color: #fff; font-weight: 700; font-size: 13px;
  box-shadow: 0 2px 8px rgba(32, 33, 36, .28); cursor: pointer; pointer-events: auto;
}
.ms-marker.is-active { outline: 3px solid #fbbc04; outline-offset: 2px; }
.ms-marker.is-uncertain { border-style: dashed; background: #5f6368; }
.ms-empty {
  min-height: 480px; display: grid; place-items: center; padding: 24px; text-align: center;
  color: #5f6368; background: #fff; border: 1px dashed #c7cdd3; border-radius: 8px;
}
.ms-list { display: grid; gap: 10px; padding: 0 12px 14px; }
.ms-annotation {
  border: 1px solid #dfe3e7; border-radius: 8px; background: #fff; padding: 12px; text-align: left; cursor: pointer;
}
.ms-annotation:hover { border-color: #9aa0a6; }
.ms-annotation.is-active { border-color: #1a73e8; box-shadow: 0 0 0 2px #e8f0fe inset; }
.ms-annotation-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
.ms-number {
  width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; background: #1a73e8; color: #fff; font-weight: 700; font-size: 12px; flex: 0 0 auto;
}
.ms-annotation-title { font-weight: 700; overflow-wrap: anywhere; }
.ms-description { color: #3c4043; line-height: 1.5; overflow-wrap: anywhere; }
.ms-description p { margin: 0 0 8px; }
.ms-description p:last-child { margin-bottom: 0; }
.ms-policy { display: inline-block; margin: 8px 6px 0 0; padding: 3px 6px; border-radius: 4px; background: #f1f3f4; color: #3c4043; font-size: 12px; }
.ms-transition {
  display: block; margin-top: 8px; padding: 5px 8px; border: 1px solid #d2e3fc; border-radius: 6px;
  background: #e8f0fe; color: #1a73e8; font-size: 12px; font-weight: 600; text-align: left;
  cursor: pointer; width: 100%; overflow-wrap: anywhere;
}
.ms-transition:hover { background: #d2e3fc; }
/* 프로세스 흐름도 (output-standard §2 섹션 2) — 넓은 그래프는 섹션 안에서만 가로 스크롤 */
.ms-flow { background: #fff; border-bottom: 1px solid #dfe3e7; }
.ms-flow-head { display: flex; align-items: center; justify-content: space-between; padding-right: 12px; }
.ms-flow-head .ms-section-title { padding-bottom: 8px; }
/* 큰 그래프가 본문(3컬럼)을 밀어내지 않도록 높이를 제한하고 섹션 안에서만 스크롤 */
.ms-flow-body { overflow: auto; max-height: 40vh; padding: 0 14px 14px; }
.ms-flow-body svg { display: block; }
.ms-flow-edge { fill: none; stroke: #5f6368; stroke-width: 1.5; }
.ms-flow-label { font: 600 11px/1 Inter, ui-sans-serif, system-ui, sans-serif; fill: #5f6368; paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.ms-flow-node { cursor: pointer; }
.ms-flow-node rect { fill: #e8f0fe; stroke: #9ec1f7; }
.ms-flow-node text { font: 600 12px/1 Inter, ui-sans-serif, system-ui, sans-serif; fill: #174ea6; }
.ms-flow-node:hover rect { fill: #d2e3fc; }
.ms-flow-node.is-active rect { stroke: #1a73e8; stroke-width: 2; fill: #d2e3fc; }
.ms-warning { color: #b06000; font-weight: 700; }
@media (max-width: 900px) {
  /* 1단 스택은 뷰포트에 3컬럼이 다 안 들어간다 — 페이지 스크롤로 되돌린다 */
  .ms-shell { height: auto; min-height: 100vh; }
  .ms-header { align-items: flex-start; flex-direction: column; }
  .ms-meta { white-space: normal; }
  .ms-layout { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }
  .ms-sidebar, .ms-panel { border: 0; border-bottom: 1px solid #dfe3e7; max-height: 240px; }
  .ms-main { order: 2; }
  .ms-panel { order: 3; max-height: none; }
}
`.trim();

export interface SnapshotBundle {
  sceneId: string;
  assetKey: string;
  base64: string;
  byteLength: number;
}

export interface ExportHtmlInput {
  project: SpecProject;
  snapshots: SnapshotBundle[];
  viewerScript: string;
  generatedAt?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function stripSourceMapComment(script: string): string {
  return script.replace(/\/\/# sourceMappingURL=.*$/gm, "").trim();
}

function downloadFilename(projectName: string): string {
  const base = projectName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "mockspec-export";
  return `${base}.html`;
}

function asciiHeaderFilename(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/["\\]/g, "-")
    .replace(/-+/g, "-");
  return ascii === ".html" || !ascii.trim() ? "mockspec-export.html" : ascii;
}

async function readViewerScript(): Promise<string> {
  if (process.env.MOCKSPEC_VIEWER_SCRIPT) return process.env.MOCKSPEC_VIEWER_SCRIPT;
  const viewerDistUrl = new URL("../../../viewer/dist/main.js", import.meta.url);
  return stripSourceMapComment(await fs.readFile(viewerDistUrl, "utf8"));
}

export function buildExportHtml({ project, snapshots, viewerScript, generatedAt }: ExportHtmlInput): string {
  const generated = generatedAt ?? new Date().toISOString();
  const snapshotTags = snapshots
    .map((snapshot) =>
      `<script type="text/plain" data-snapshot="${escapeAttribute(snapshot.sceneId)}" data-asset="${escapeAttribute(snapshot.assetKey)}">${snapshot.base64}</script>`,
    )
    .join("\n  ");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="mockspec">
  <meta name="mockspec-generated-at" content="${escapeAttribute(generated)}">
  <title>${escapeHtml(project.name)} 기획서</title>
  <style>${VIEWER_CSS}</style>
</head>
<body>
  <script type="application/json" id="spec-data">${escapeJsonForScript(project)}</script>
  ${snapshotTags}
  <div id="app"></div>
  <script type="module">
${stripSourceMapComment(viewerScript)}
  </script>
</body>
</html>`;
}

export async function exportProjectHtml(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const project = await readSpec(req.params.id);
    if (!project) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);

    const snapshots: SnapshotBundle[] = [];
    let usedMasked = false;
    for (const scene of project.scenes) {
      const assetKey = scene.maskedSnapshotAsset || scene.snapshotAsset;
      if (!assetKey) continue;
      const data = await readAsset(project.id, assetKey);
      if (!data) continue;
      if (assetKey === scene.maskedSnapshotAsset) usedMasked = true;
      snapshots.push({
        sceneId: scene.id,
        assetKey: assetKey,
        base64: data.toString("base64"),
        byteLength: data.byteLength,
      });
    }

    const html = buildExportHtml({
      project,
      snapshots,
      viewerScript: await readViewerScript(),
    });

    // [T29] 산출물 이력 — 메타만 기록, best-effort (이력 실패가 export를 막지 않는다. §6.3)
    await appendExportRecord(project.id, {
      specUpdatedAt: project.updatedAt,
      bytes: Buffer.byteLength(html, "utf8"),
      masked: usedMasked,
    }).catch(() => undefined);

    if (Buffer.byteLength(html, "utf8") > EXPORT_SIZE_WARNING_BYTES) {
      res.set("X-Mockspec-Warning", "EXPORT_TOO_LARGE");
    }

    const filename = downloadFilename(project.name);
    res
      .status(200)
      .type("text/html; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="${asciiHeaderFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .send(html);
  } catch (err) {
    next(err);
  }
}
