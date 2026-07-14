import fs from "node:fs/promises";
import { customAlphabet } from "nanoid";
import type { ExportRecord } from "@mockspec/shared";
import { exportsFile } from "./paths.js";

/**
 * [T29] 산출물 이력 — 메타 전용 (technical-spec §6.3, FR-EXP-08).
 *
 * 모든 export 경로(콘솔·SDK·확장)가 POST /projects/:id/export 한 곳을 지나므로
 * 그 라우트가 기록한다. 산출물 HTML 자체는 보관하지 않는다 — 수십 MB짜리를
 * 매번 쌓는 건 저장소 부담이고, 재다운로드는 재-export로 충분(§2.2 htmlRef 미채택).
 */

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export async function readExportRecords(projectId: string): Promise<ExportRecord[]> {
  try {
    const raw = await fs.readFile(exportsFile(projectId), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ExportRecord[]) : [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** 이력 1건 추가. 레코드 id·시각은 여기서 부여한다. */
export async function appendExportRecord(
  projectId: string,
  meta: { specUpdatedAt: string; bytes: number; masked: boolean },
): Promise<ExportRecord> {
  const record: ExportRecord = {
    id: `exp_${nano()}`,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  const records = await readExportRecords(projectId);
  records.push(record);
  await fs.writeFile(exportsFile(projectId), JSON.stringify(records, null, 2), "utf8");
  return record;
}

/** 콘솔 목록용 요약 (technical-spec §6 — GET /projects 항목에 동봉). */
export async function exportSummary(
  projectId: string,
): Promise<{ exportCount: number; lastExportAt?: string }> {
  const records = await readExportRecords(projectId);
  const last = records[records.length - 1];
  return { exportCount: records.length, ...(last ? { lastExportAt: last.createdAt } : {}) };
}
