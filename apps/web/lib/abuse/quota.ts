import type { Db } from "../store/ids.js";
import { assetPrefix, mockupPrefix } from "../store/ids.js";
import { sumObjectBytes } from "../store/storage-list.js";
import { LIMITS, formatMb } from "./limits.js";

/**
 * 쿼터 검사 — 초과 시 사용자에게 보일 메시지를 돌려주고(호출자가 403 QUOTA_EXCEEDED),
 * 통과면 null. 예외를 던지지 않는 이유는 라우트에서 분기가 한 줄로 끝나기 때문.
 */

/** 사용자당 프로젝트 수 (RLS가 소유자 범위로 제한하므로 count가 곧 본인 프로젝트 수). */
export async function checkProjectCountQuota(db: Db): Promise<string | null> {
  const { count, error } = await db
    .from("projects")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(`checkProjectCountQuota failed: ${error.message}`);
  if ((count ?? 0) >= LIMITS.maxProjectsPerUser) {
    return `프로젝트 수 한도(${LIMITS.maxProjectsPerUser}개)에 도달했습니다. 기존 프로젝트를 삭제한 뒤 다시 시도해 주세요.`;
  }
  return null;
}

/** 프로젝트당 목업 총 크기 — Storage에 실제로 올라간 바이트로 판정(신뢰 경계). */
export async function checkMockupSizeQuota(db: Db, projectId: string): Promise<string | null> {
  const bytes = await sumObjectBytes(db, mockupPrefix(projectId));
  if (bytes > LIMITS.mockupMaxTotalBytes) {
    return `목업 총 크기가 한도(${formatMb(LIMITS.mockupMaxTotalBytes)})를 초과했습니다 — 업로드된 ${formatMb(bytes)}.`;
  }
  return null;
}

/** 프로젝트당 asset 총 크기 — 새로 올릴 크기를 더해 사전 판정. */
export async function checkAssetSizeQuota(
  db: Db,
  projectId: string,
  incomingBytes: number,
): Promise<string | null> {
  const used = await sumObjectBytes(db, assetPrefix(projectId));
  if (used + incomingBytes > LIMITS.assetsMaxTotalBytes) {
    return `스냅샷 총 크기가 프로젝트 한도(${formatMb(LIMITS.assetsMaxTotalBytes)})를 초과합니다 — 현재 ${formatMb(used)}.`;
  }
  return null;
}
