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

/**
 * 프로젝트별 쓰기 직렬화 체인. append는 읽기→수정→쓰기(read-modify-write)라
 * 같은 프로젝트에 동시 export(더블클릭 등)가 겹치면 레코드가 유실될 수 있다.
 * 프로젝트당 마지막 작업 promise 뒤에 이어 붙여 순차 실행한다. 완료된 체인은
 * 정리해 Map이 무한정 커지지 않게 한다 (프로젝트 수만큼만 잠깐 존재).
 */
const writeChains = new Map<string, Promise<unknown>>();

function serialize<T>(projectId: string, task: () => Promise<T>): Promise<T> {
  const prev = writeChains.get(projectId) ?? Promise.resolve();
  const run = prev.then(task, task); // 앞 작업이 실패해도 다음 작업은 진행
  writeChains.set(projectId, run);
  void run.finally(() => {
    if (writeChains.get(projectId) === run) writeChains.delete(projectId);
  });
  return run;
}

export async function readExportRecords(projectId: string): Promise<ExportRecord[]> {
  try {
    const raw = await fs.readFile(exportsFile(projectId), "utf8");
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ExportRecord[]) : [];
    } catch {
      // 손상·불완전 쓰기된 파일은 빈 이력으로 취급 — 이력은 best-effort라
      // 목록 조회(GET /projects) 전체를 500으로 깨뜨리지 않는다. 다음 append가
      // 정상 JSON으로 덮어써 자가 치유한다.
      return [];
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/** 이력 1건 추가. 레코드 id·시각은 여기서 부여한다. 같은 프로젝트 쓰기는 직렬화된다. */
export async function appendExportRecord(
  projectId: string,
  meta: { specUpdatedAt: string; bytes: number; masked: boolean },
): Promise<ExportRecord> {
  return serialize(projectId, async () => {
    const record: ExportRecord = {
      id: `exp_${nano()}`,
      createdAt: new Date().toISOString(),
      ...meta,
    };
    const records = await readExportRecords(projectId);
    records.push(record);
    await fs.writeFile(exportsFile(projectId), JSON.stringify(records, null, 2), "utf8");
    return record;
  });
}

/** 콘솔 목록용 요약 (technical-spec §6 — GET /projects 항목에 동봉). */
export async function exportSummary(
  projectId: string,
): Promise<{ exportCount: number; lastExportAt?: string }> {
  const records = await readExportRecords(projectId);
  const last = records[records.length - 1];
  return { exportCount: records.length, ...(last ? { lastExportAt: last.createdAt } : {}) };
}
