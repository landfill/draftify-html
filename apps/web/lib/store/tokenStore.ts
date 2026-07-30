import crypto from "node:crypto";
import { customAlphabet } from "nanoid";
import type { Db } from "./ids.js";

/**
 * 경로 D 프로젝트 토큰 — 기존 파일 기반(tokenStore.ts)의 이식. 평문은 발급 순간 1회만 반환,
 * 서버는 SHA-256 해시만 보관. 프로젝트당 활성 토큰 1개(재발급 시 구 토큰 즉시 무효).
 *
 * 클라이언트 구분(중요):
 *  - issue·revoke·has: 콘솔에서 소유자가 호출 → 요청 스코프 클라이언트(RLS owner). project_tokens
 *    RLS가 부모 projects 소유권을 검증한다.
 *  - verify: 경로 D 저장 요청은 사용자 세션 없이 Bearer 토큰만 갖는다 → RLS로 못 읽으므로
 *    호출자가 **관리 클라이언트(secret 키, service_role 권한)**를 넘겨야 한다(W6에서 배선). 어댑터는 넘어온
 *    클라이언트를 그대로 쓴다.
 */

const metaNano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

function makeToken(): string {
  return `tok_${crypto.randomBytes(24).toString("base64url")}`;
}
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/** 토큰 발급(재발급 시 기존 토큰 대체). 반환 평문은 이 순간뿐. */
export async function issueToken(db: Db, projectId: string): Promise<string> {
  const token = makeToken();
  // 활성 토큰 1개 유지 — `project_tokens.project_id` UNIQUE 위에서 한 문장으로 교체한다.
  // delete + insert 2단계였을 때는 동시 재발급이 행을 2개 남겨 verifyToken()의
  // maybeSingle()이 에러를 냈고, 그 프로젝트가 인증 불능으로 잠겼다(이슈 #47).
  // 경합해도 남는 행은 1개이며, 마지막에 쓴 토큰만 유효하다.
  const { error } = await db.from("project_tokens").upsert(
    {
      id: `tokmeta_${metaNano()}`,
      project_id: projectId,
      token_hash: hashToken(token),
      created_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "project_id" },
  );
  if (error) throw new Error(`issueToken failed: ${error.message}`);
  return token;
}

/** 토큰 검증. 미발급·폐기(revoked_at)·형식 불일치·해시 불일치 전부 false. */
export async function verifyToken(db: Db, projectId: string, token: string): Promise<boolean> {
  const { data, error } = await db
    .from("project_tokens")
    .select("token_hash, revoked_at")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return false;
  if (typeof data.token_hash !== "string" || data.token_hash.length === 0) return false;
  const given = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(data.token_hash, "hex");
  if (given.length !== stored.length) return false;
  return crypto.timingSafeEqual(given, stored);
}

/** 토큰 폐기 — 이후 verify는 항상 false. */
export async function revokeToken(db: Db, projectId: string): Promise<void> {
  const { error } = await db.from("project_tokens").delete().eq("project_id", projectId);
  if (error) throw new Error(`revokeToken failed: ${error.message}`);
}

/** 발급 여부(콘솔 표시용 — 평문·해시 미노출). */
export async function hasToken(db: Db, projectId: string): Promise<boolean> {
  const { count, error } = await db
    .from("project_tokens")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .is("revoked_at", null);
  if (error) throw new Error(`hasToken failed: ${error.message}`);
  return (count ?? 0) > 0;
}
