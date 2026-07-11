/**
 * [S2.5] 경로 D 연결 코드 (pathD 킥오프 §3, 실사용 1차 피드백).
 *
 * 확장 팝업은 포커스를 잃으면 닫히므로 "프로젝트 ID·토큰을 각각 복사·붙여넣기"가 성립하지
 * 않는다(콘솔로 값을 복사하러 가면 팝업이 닫힘). 그래서 셋을 하나의 불투명 코드로 합쳐
 * **한 번 복사 → 한 번 붙여넣기**로 연결한다.
 *
 * 형식: `mockspec:` + base64url(JSON{ p: projectId, t: token, s: serverUrl }).
 * 서명·암호화는 하지 않는다 — 코드 자체가 곧 토큰(비밀)이라 사용자가 다루는 값이며,
 * 내용 확인은 팝업이 파싱해 보여준다.
 */

export interface ConnectionInfo {
  projectId: string;
  token: string;
  serverUrl: string;
}

const PREFIX = "mockspec:";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeConnection(info: ConnectionInfo): string {
  const json = JSON.stringify({ p: info.projectId, t: info.token, s: info.serverUrl });
  return PREFIX + toBase64Url(new TextEncoder().encode(json));
}

/** 파싱 실패(형식 오류·필드 누락)면 null. 팝업이 이 값으로 유효성을 판단한다. */
export function decodeConnection(code: string): ConnectionInfo | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(trimmed.slice(PREFIX.length)));
    const obj = JSON.parse(json) as { p?: unknown; t?: unknown; s?: unknown };
    if (typeof obj.p !== "string" || typeof obj.t !== "string" || typeof obj.s !== "string") return null;
    if (!obj.p.startsWith("prj_") || !obj.t.startsWith("tok_")) return null;
    return { projectId: obj.p, token: obj.t, serverUrl: obj.s };
  } catch {
    return null;
  }
}
