/**
 * [S2.5] 오리진별 프로젝트 바인딩 (pathD 킥오프 §3).
 * 확장 팝업이 저장하고 content script가 읽는다 — chrome.storage.local 한 곳.
 * 토큰은 사용자 브라우저 프로필 안에만 머문다 (서버는 해시만 보관).
 */

export interface Binding {
  projectId: string;
  /** 저장 계열 인증 토큰 (T20 게이트). background 경유 저장에 사용 (T23) */
  token: string;
  /** mockspec 서버 오리진 (기본 http://localhost:4000 = 사내판). 오리진 하드코딩 금지(ID-01) — 사용자 입력 */
  serverUrl: string;
}

export const bindingKey = (origin: string): string => `binding:${origin}`;

export async function readBinding(origin: string): Promise<Binding | null> {
  const key = bindingKey(origin);
  const items = await chrome.storage.local.get(key);
  const value = items[key] as Binding | undefined;
  return value && value.projectId ? value : null;
}

export async function writeBinding(origin: string, binding: Binding): Promise<void> {
  await chrome.storage.local.set({ [bindingKey(origin)]: binding });
}

export async function removeBinding(origin: string): Promise<void> {
  await chrome.storage.local.remove(bindingKey(origin));
}
