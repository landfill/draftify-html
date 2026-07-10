import crypto from "node:crypto";
import fs from "node:fs/promises";
import { tokenFile } from "./paths.js";

/**
 * [S2.5] 경로 D 프로젝트 토큰 (pathD 킥오프 §4.1, §8-2).
 *
 * 경로 D의 SDK는 서비스 도메인 밖 임의 오리진에서 돌기 때문에 same-origin 신뢰가 없다 —
 * 임의 페이지가 남의 프로젝트에 쓰지 못하게 하는 유일한 경계가 이 토큰이다.
 *
 * - 평문은 발급 순간 1회만 반환하고 서버는 SHA-256 해시만 보관한다.
 * - 저장 위치는 spec.json 밖 별도 메타 파일 (paths.ts::tokenFile 주석 참조).
 * - 만료 없음(사내 도구 규모에 회전 정책은 과잉) — 재발급 시 구 토큰 즉시 무효.
 */

interface TokenMeta {
  /** SHA-256(token) hex */
  tokenHash: string;
  /** ISO 8601 */
  issuedAt: string;
}

/** "tok_" + 192bit 난수(base64url 32자). Authorization 헤더에 그대로 실을 수 있는 문자만. */
function makeToken(): string {
  return `tok_${crypto.randomBytes(24).toString("base64url")}`;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * 토큰 발급. 기존 토큰이 있으면 대체(구 토큰 즉시 무효 — 재발급 규칙).
 * 반환된 평문은 이 순간뿐 — 다시 조회할 수 없다.
 */
export async function issueToken(projectId: string): Promise<string> {
  const token = makeToken();
  const meta: TokenMeta = { tokenHash: hashToken(token), issuedAt: new Date().toISOString() };
  await fs.writeFile(tokenFile(projectId), JSON.stringify(meta, null, 2), "utf8");
  return token;
}

/** 토큰 검증. 메타 없음(미발급·폐기)·형식 불일치·해시 불일치 전부 false. */
export async function verifyToken(projectId: string, token: string): Promise<boolean> {
  let meta: TokenMeta;
  try {
    meta = JSON.parse(await fs.readFile(tokenFile(projectId), "utf8")) as TokenMeta;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw err;
  }
  if (typeof meta.tokenHash !== "string" || meta.tokenHash.length === 0) return false;
  const given = Buffer.from(hashToken(token), "hex");
  const stored = Buffer.from(meta.tokenHash, "hex");
  // timingSafeEqual은 길이 불일치 시 throw — sha256 hex는 항상 32바이트지만 방어적으로 확인
  if (given.length !== stored.length) return false;
  return crypto.timingSafeEqual(given, stored);
}

/** 토큰 폐기 — 이후 verifyToken은 항상 false. 재발급 전까지 저장 계열 접근 불가. */
export async function revokeToken(projectId: string): Promise<void> {
  await fs.rm(tokenFile(projectId), { force: true });
}

/** 발급 여부 (콘솔 표시용 — 평문·해시는 노출하지 않는다). */
export async function hasToken(projectId: string): Promise<boolean> {
  try {
    await fs.access(tokenFile(projectId));
    return true;
  } catch {
    return false;
  }
}
