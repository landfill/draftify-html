import { readBinding, writeBinding, removeBinding } from "./binding.js";

/**
 * [S2.5] 팝업 — 현재 탭 오리진에 프로젝트를 바인딩한다 (pathD 킥오프 §3).
 * activeTab 권한: 사용자가 팝업을 여는 행위가 곧 현재 탭 접근 허용이라 tab.url을 읽을 수 있다.
 */

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const originEl = $("origin");
const projectIdEl = $<HTMLInputElement>("project-id");
const tokenEl = $<HTMLInputElement>("token");
const serverUrlEl = $<HTMLInputElement>("server-url");
const saveBtn = $<HTMLButtonElement>("save");
const removeBtn = $<HTMLButtonElement>("remove");
const statusEl = $("status");

function setStatus(text: string, kind?: "ok" | "error"): void {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

async function currentOrigin(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

void (async () => {
  const origin = await currentOrigin();
  if (!origin) {
    originEl.textContent = "이 페이지에서는 사용할 수 없습니다 (http/https 탭에서 열어주세요).";
    saveBtn.disabled = true;
    removeBtn.disabled = true;
    return;
  }
  originEl.textContent = origin;

  const existing = await readBinding(origin);
  if (existing) {
    projectIdEl.value = existing.projectId;
    tokenEl.value = existing.token;
    serverUrlEl.value = existing.serverUrl;
    setStatus("이 사이트에 연결되어 있습니다.", "ok");
  }

  saveBtn.addEventListener("click", () => {
    void (async () => {
      const projectId = projectIdEl.value.trim();
      const token = tokenEl.value.trim();
      const serverUrl = serverUrlEl.value.trim().replace(/\/+$/, "");
      if (!projectId || !token || !serverUrl) {
        setStatus("프로젝트 ID·토큰·서버 주소를 모두 입력해주세요.", "error");
        return;
      }
      await writeBinding(origin, { projectId, token, serverUrl });
      setStatus("저장됨 — 페이지를 새로고침하면 편집 버튼이 나타납니다.", "ok");
    })();
  });

  removeBtn.addEventListener("click", () => {
    void (async () => {
      await removeBinding(origin);
      projectIdEl.value = "";
      tokenEl.value = "";
      setStatus("해제됨 — 새로고침하면 편집 버튼이 사라집니다.", "ok");
    })();
  });
})();
