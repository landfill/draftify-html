import type { SpecProject } from "@mockspec/shared";
import {
  buildExportHtml,
  type SnapshotBundle,
} from "../../../../packages/server/src/routes/export.js";
import type { Db } from "../store/ids.js";
import { readAsset } from "../store/projectStore.js";
import { VIEWER_SCRIPT } from "./viewer-script.js";

/** Vercel 서버리스 응답 본문 한계 회피 — 이보다 크면 Storage+302. */
export const EXPORT_INLINE_MAX_BYTES = 4 * 1024 * 1024;

export const EXPORT_SIZE_WARNING_BYTES = 50 * 1024 * 1024;

export function exportObjectPath(projectId: string, exportId: string): string {
  return `projects/${projectId}/exports/${exportId}.html`;
}

export function downloadFilename(projectName: string): string {
  const base =
    projectName
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "mockspec-export";
  return `${base}.html`;
}

export function asciiHeaderFilename(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/["\\]/g, "-")
    .replace(/-+/g, "-");
  return ascii === ".html" || !ascii.trim() ? "mockspec-export.html" : ascii;
}

export async function assembleExportHtml(
  db: Db,
  project: SpecProject,
): Promise<{ html: string; usedMasked: boolean }> {
  const snapshots: SnapshotBundle[] = [];
  let usedMasked = false;

  for (const scene of project.scenes) {
    const assetKey = scene.maskedSnapshotAsset || scene.snapshotAsset;
    if (!assetKey) continue;
    const data = await readAsset(db, project.id, assetKey);
    if (!data) continue;
    if (assetKey === scene.maskedSnapshotAsset) usedMasked = true;
    snapshots.push({
      sceneId: scene.id,
      assetKey,
      base64: Buffer.from(data).toString("base64"),
      byteLength: data.byteLength,
    });
  }

  const html = buildExportHtml({
    project,
    snapshots,
    viewerScript: VIEWER_SCRIPT,
  });

  return { html, usedMasked };
}
