import fs from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import type { SpecProject } from "@mockspec/shared";
import { readAsset, readSpec } from "../store/projectStore.js";
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
.ms-shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr; }
.ms-header {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; background: #fff; border-bottom: 1px solid #dfe3e7;
}
.ms-title { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; }
.ms-meta { color: #5f6368; font-size: 13px; white-space: nowrap; }
.ms-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr) 320px; min-height: 0; }
.ms-sidebar, .ms-panel {
  background: #fff; border-right: 1px solid #dfe3e7; overflow: auto; min-width: 0;
}
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
.ms-stage-header { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 12px; }
.ms-stage-title { margin: 0; font-size: 16px; line-height: 1.4; }
.ms-note { margin: 6px 0 0; color: #5f6368; font-size: 13px; }
.ms-stage-wrap {
  position: relative; min-height: 480px; background: #fff; border: 1px solid #dfe3e7;
  border-radius: 8px; overflow: hidden;
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
.ms-warning { color: #b06000; font-weight: 700; }
@media (max-width: 900px) {
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
    for (const scene of project.scenes) {
      const assetKey = scene.maskedSnapshotAsset || scene.snapshotAsset;
      if (!assetKey) continue;
      const data = await readAsset(project.id, assetKey);
      if (!data) continue;
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
