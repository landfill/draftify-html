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

/** 콘솔 목록용 요약 (단건). 여러 건은 아래 `exportSummaries`를 쓴다. */
export async function exportSummary(db: Db, projectId: string): Promise<ExportSummary> {
  const records = await readExportRecords(db, projectId);
  const last = records[records.length - 1];
  return { exportCount: records.length, ...(last ? { lastExportAt: last.createdAt } : {}) };
}

/**
 * 여러 프로젝트의 요약을 **한 번의 쿼리로** 가져온다 (이슈 #81).
 *
 * 프로젝트마다 `exportSummary()`를 부르면 1 + N 왕복이 된다. 왕복 단가가 ~17ms까지
 * 내려온 지금도(#71 리전 고정) 프로젝트가 20개면 그대로 20번이고, RLS가 매 요청
 * 부모 `projects` 소유권 서브쿼리를 다시 돈다.
 *
 * 이력 **전체**가 아니라 집계만 필요하므로 `id`·`bytes`·`masked`는 가져오지 않는다.
 * 반환에 없는 projectId는 export 0회다(호출부가 기본값을 채운다).
 */
export async function exportSummaries(
  db: Db,
  projectIds: readonly string[],
): Promise<Map<string, ExportSummary>> {
  const out = new Map<string, ExportSummary>();
  if (projectIds.length === 0) return out;

  const { data, error } = await db
    .from("project_exports")
    .select("project_id, created_at")
    .in("project_id", [...projectIds]);
  if (error) throw new Error(`exportSummaries failed: ${error.message}`);

  for (const row of data ?? []) {
    const at = new Date(row.created_at).toISOString();
    const prev = out.get(row.project_id);
    if (!prev) {
      out.set(row.project_id, { exportCount: 1, lastExportAt: at });
      continue;
    }
    // ISO 8601은 형식이 같으면 사전순 = 시간순이라 문자열 비교로 최댓값을 고를 수 있다.
    out.set(row.project_id, {
      exportCount: prev.exportCount + 1,
      lastExportAt: prev.lastExportAt && prev.lastExportAt > at ? prev.lastExportAt : at,
    });
  }
  return out;
}
