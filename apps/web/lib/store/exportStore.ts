import { customAlphabet } from "nanoid";
import type { ExportRecord } from "@mockspec/shared";
import type { Db } from "./ids.js";

/**
 * 산출물 이력(메타 전용) — 기존 파일 기반(exportStore.ts)의 이식. 산출물 HTML 자체는 보관 안 함.
 *
 * 파일 기반은 프로젝트별 write 직렬화(read-modify-write 경합)를 앱 레벨에서 했지만, Postgres는
 * append가 단일 INSERT라 동시 export가 겹쳐도 레코드 유실이 없다 — 직렬화 체인 불필요.
 * RLS(project_tokens와 동일하게 부모 projects 소유권)가 접근을 격리한다.
 */

const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export async function readExportRecords(db: Db, projectId: string): Promise<ExportRecord[]> {
  const { data, error } = await db
    .from("project_exports")
    .select("id, created_at, spec_updated_at, bytes, masked")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`readExportRecords failed: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    specUpdatedAt: r.spec_updated_at,
    bytes: r.bytes,
    masked: r.masked,
  }));
}

/** 이력 1건 추가. 레코드 id·시각은 여기서 부여. */
export async function appendExportRecord(
  db: Db,
  projectId: string,
  meta: { specUpdatedAt: string; bytes: number; masked: boolean },
): Promise<ExportRecord> {
  const record: ExportRecord = {
    id: `exp_${nano()}`,
    createdAt: new Date().toISOString(),
    ...meta,
  };
  const { error } = await db.from("project_exports").insert({
    id: record.id,
    project_id: projectId,
    created_at: record.createdAt,
    spec_updated_at: record.specUpdatedAt,
    bytes: record.bytes,
    masked: record.masked,
  });
  if (error) throw new Error(`appendExportRecord failed: ${error.message}`);
  return record;
}

/** 콘솔 목록용 요약. */
export async function exportSummary(
  db: Db,
  projectId: string,
): Promise<{ exportCount: number; lastExportAt?: string }> {
  const records = await readExportRecords(db, projectId);
  const last = records[records.length - 1];
  return { exportCount: records.length, ...(last ? { lastExportAt: last.createdAt } : {}) };
}
