import { decodeConnection } from "@mockspec/shared";
import { readBinding, writeBinding, removeBinding, type Binding } from "./binding.js";

/**
 * [S2.5] 팝업 — 현재 탭 오리진에 프로젝트를 바인딩한다 (pathD 킥오프 §3).
 *
 * 팝업은 포커스를 잃으면 닫히므로 값을 두 번 복사·붙여넣는 방식은 성립하지 않는다.
 * 그래서 **연결 코드 하나(붙여넣기 1회)**를 주 경로로 둔다. 직접 입력은 fallback(details).
 * activeTab: 사용자가 팝업을 여는 행위가 곧 현재 탭 접근 허용이라 tab.url을 읽을 수 있다.
 */

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const originEl = $("origin");
const codeEl = $<HTMLTextAreaElement>("code");
const connectBtn = $<HTMLButtonElement>("connect");
const removeBtn = $<HTMLButtonElement>("remove");
const saveBtn = $<HTMLButtonElement>("save");
const projectIdEl = $<HTMLInputElement>("project-id");
const tokenEl = $<HTMLInputElement>("token");
const serverUrlEl = $<HTMLInputElement>("server-url");
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

async function bind(origin: string, binding: Binding): Promise<void> {
  await writeBinding(origin, binding);
  setStatus("연결됨 — 대상 페이지를 새로고침하면 편집 버튼이 나타납니다.", "ok");
}

void (async () => {
  const origin = await currentOrigin();
  if (!origin) {
    originEl.textContent = "이 페이지에서는 사용할 수 없습니다 (http/https 탭에서 열어주세요).";
    [connectBtn, removeBtn, saveBtn].forEach((b) => (b.disabled = true));
    return;
  }
  originEl.textContent = origin;

  const existing = await readBinding(origin);
  if (existing) {
    projectIdEl.value = existing.projectId;
    tokenEl.value = existing.token;
    serverUrlEl.value = existing.serverUrl;
    setStatus(`이 사이트는 ${existing.projectId}에 연결되어 있습니다.`, "ok");
  }

  // 주 경로: 연결 코드 1회 붙여넣기
  connectBtn.addEventListener("click", () => {
    void (async () => {
      const info = decodeConnection(codeEl.value);
      if (!info) {
        setStatus("연결 코드를 인식하지 못했습니다 — 콘솔의 [연결 코드 복사] 값을 그대로 붙여넣어주세요.", "error");
        return;
      }
      await bind(origin, info);
      codeEl.value = "";
    })();
  });

  // fallback: 직접 입력
  saveBtn.addEventListener("click", () => {
    void (async () => {
      const projectId = projectIdEl.value.trim();
      const token = tokenEl.value.trim();
      const serverUrl = serverUrlEl.value.trim().replace(/\/+$/, "");
      if (!projectId.startsWith("prj_")) {
        setStatus("프로젝트 이름이 아니라 ID(prj_…)를 넣어주세요.", "error");
        return;
      }
      if (!token.startsWith("tok_")) {
        setStatus("토큰(tok_…)이 올바르지 않습니다 — 콘솔에서 발급/재발급한 값을 넣어주세요.", "error");
        return;
      }
      if (!serverUrl) {
        setStatus("서버 주소를 입력해주세요.", "error");
        return;
      }
      await bind(origin, { projectId, token, serverUrl });
    })();
  });

  removeBtn.addEventListener("click", () => {
    void (async () => {
      await removeBinding(origin);
      codeEl.value = "";
      projectIdEl.value = "";
      tokenEl.value = "";
      setStatus("해제됨 — 새로고침하면 편집 버튼이 사라집니다.", "ok");
    })();
  });
})();
