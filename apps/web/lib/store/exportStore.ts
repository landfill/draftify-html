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
    createdAt: new Date(r.created_at).toISOString(),
    specUpdatedAt: new Date(r.spec_updated_at).toISOString(),
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

export type ExportSummary = { exportCount: number; lastExportAt?: string };

/**
 * 콘솔 목록용 요약.
 *
 * **프로젝트별로 부른다(1 + N 왕복).** 이걸 `.in()` 한 방으로 합치는 시도를 PR #84에서
 * 했다가 철회했다 — PostgREST가 돌려주는 행 수에는 상한이 있고(호스팅 Supabase 기본
 * 1,000), 넘으면 **오류 없이 잘린 결과**가 온다. 여러 프로젝트를 합치면 그 상한이
 * *사용자 전체 export 합계*에 걸려 **각 프로젝트가 개별 한도 아래인데도** `exportCount`가
 * 조용히 틀리게 된다. export 이력에는 개수 한도가 없어(레이트리밋만 시간당 30회) 누적되면
 * 반드시 도달하는 경로다.
 *
 * 제대로 합치려면 DB가 `group by`로 집계해야 한다(RPC + 마이그레이션). 목록 성능이 실제로
 * 문제가 되면 그때 별건으로 한다 — 조용히 틀린 숫자를 보여 주는 것보다 왕복이 나은 거래다.
 */
export async function exportSummary(db: Db, projectId: string): Promise<ExportSummary> {
  const records = await readExportRecords(db, projectId);
  const last = records[records.length - 1];
  return { exportCount: records.length, ...(last ? { lastExportAt: last.createdAt } : {}) };
}
