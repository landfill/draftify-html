import type { Request, Response } from "express";
import { WORKING_NAME } from "@mockspec/shared";

/**
 * 콘솔 페이지 (T9 — detailed-spec §2, FR-CON-01~03).
 *
 * S1은 서버가 서빙하는 정적 HTML 1장. 프레임워크 금지 (React는 S2에서 필요해질 때).
 * 클라이언트 JS는 상대 경로(`/api/*`)만 호출한다 (ID-01 — 오리진 하드코딩 금지).
 * 목업/편집 URL은 `location.host` 기준으로 서브도메인을 조립한다.
 */

const CONSOLE_CSS = `
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1e293b;
  background: linear-gradient(135deg, #e0e7ff 0%, #ede9fe 50%, #f3e8ff 100%);
  min-height: 100vh;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; min-height: 100vh; background: transparent; }
button, input { font: inherit; }
.c-shell { max-width: 800px; margin: 0 auto; padding: 40px 20px 60px; }
.c-title { margin: 0 0 30px; font-size: 28px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px; }
.c-card { 
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
  border-radius: 16px; 
  padding: 24px; 
  margin-bottom: 24px; 
}
.c-card h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #334155; }
.c-row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
.c-row label { flex: 0 0 120px; font-size: 14px; font-weight: 600; color: #475569; }
.c-row input[type="text"], .c-row input[type="file"] { 
  flex: 1 1 220px; 
  padding: 10px 14px; 
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(203, 213, 225, 0.6); 
  border-radius: 8px; 
  transition: all 0.2s ease;
}
.c-row input[type="text"]:focus, .c-row input[type="file"]:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
  background: #fff;
}
.c-hint { margin: 4px 0 16px; color: #64748b; font-size: 13px; line-height: 1.6; }
.c-btn {
  padding: 10px 18px; 
  border: none; 
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); 
  color: #fff; 
  font-size: 14px;
  font-weight: 600; 
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2);
}
.c-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 10px -1px rgba(99, 102, 241, 0.3); }
.c-btn:active:not(:disabled) { transform: translateY(0); }
.c-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
.c-btn.c-btn-ghost { background: rgba(255, 255, 255, 0.5); color: #4f46e5; box-shadow: none; border: 1px solid rgba(99, 102, 241, 0.2); }
.c-btn.c-btn-ghost:hover:not(:disabled) { background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.3); }
.c-btn.c-btn-danger { background: rgba(255, 255, 255, 0.5); color: #e11d48; border: 1px solid rgba(225, 29, 72, 0.2); }
.c-btn.c-btn-danger:hover:not(:disabled) { background: rgba(225, 29, 72, 0.1); border-color: rgba(225, 29, 72, 0.3); }
.c-status { margin: 12px 0 0; font-size: 14px; line-height: 1.5; padding: 10px 14px; border-radius: 8px; background: rgba(255,255,255,0.5); display: none; }
.c-status:not(:empty) { display: block; }
.c-status.is-error { color: #be123c; background: rgba(255, 228, 230, 0.7); border: 1px solid rgba(253, 164, 175, 0.5); }
.c-status.is-ok { color: #15803d; background: rgba(220, 252, 231, 0.7); border: 1px solid rgba(134, 239, 172, 0.5); }
.c-status a { color: #4f46e5; font-weight: 600; text-decoration: none; }
.c-status a:hover { text-decoration: underline; }
.c-list { display: grid; gap: 16px; }
.c-project { 
  border: 1px solid rgba(255, 255, 255, 0.6); 
  border-radius: 12px; 
  padding: 16px 20px; 
  background: rgba(255, 255, 255, 0.4); 
  transition: all 0.2s ease;
}
.c-project:hover { background: rgba(255, 255, 255, 0.7); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); }
.c-project-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
.c-project-name { font-weight: 700; font-size: 16px; color: #1e293b; overflow-wrap: anywhere; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.c-project-meta { color: #64748b; font-size: 13px; line-height: 1.5; flex: 1 1 100%; margin-top: 4px; }
.c-project-id { display: flex; align-items: center; gap: 8px; margin: 8px 0 12px; }
.c-project-id .c-id-label { font-size: 12px; font-weight: 600; color: #64748b; }
.c-project-id code { padding: 4px 8px; background: rgba(241, 245, 249, 0.8); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 6px; font-size: 13px; user-select: all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.c-project-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.c-empty { color: #64748b; padding: 32px 20px; text-align: center; border: 1px dashed rgba(148, 163, 184, 0.6); border-radius: 12px; background: rgba(255, 255, 255, 0.4); font-size: 14px; }
.c-tabs { display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid rgba(203, 213, 225, 0.5); padding-bottom: 8px; }
.c-tab { 
  padding: 8px 16px; border: none; background: transparent; cursor: pointer; 
  font-weight: 600; font-size: 14px; color: #64748b; border-radius: 8px; transition: all 0.2s ease;
}
.c-tab:hover { background: rgba(255, 255, 255, 0.5); color: #334155; }
.c-tab[aria-selected="true"] { color: #4f46e5; background: rgba(255, 255, 255, 0.8); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.c-tabpanel { display: none; animation: fadeIn 0.3s ease; }
.c-tabpanel[aria-hidden="false"] { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
.c-badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; background: rgba(99, 102, 241, 0.1); color: #4f46e5; border: 1px solid rgba(99, 102, 241, 0.2); }
.c-snippet-result { margin-top: 20px; padding: 16px; border: 1px solid rgba(134, 239, 172, 0.5); border-radius: 12px; background: rgba(240, 253, 244, 0.6); }
.c-token-row { display: flex; gap: 8px; align-items: center; margin: 12px 0; }
.c-token-row code { flex: 1; padding: 10px 14px; background: rgba(255, 255, 255, 0.8); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 8px; font-size: 14px; word-break: break-all; user-select: all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.c-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: none; place-items: center; z-index: 100; animation: fadeIn 0.2s ease; }
.c-modal-overlay.is-open { display: grid; }
.c-modal { background: rgba(255, 255, 255, 0.95); width: 600px; max-width: 90vw; max-height: 90vh; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
.c-modal-header { padding: 20px 24px; border-bottom: 1px solid rgba(203, 213, 225, 0.5); display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.5); }
.c-modal-header h2 { margin: 0; font-size: 18px; color: #1e293b; }
.c-modal-body { padding: 24px; overflow-y: auto; flex: 1 1 auto; }
.c-modal-footer { padding: 16px 24px; border-top: 1px solid rgba(203, 213, 225, 0.5); display: flex; justify-content: flex-end; gap: 12px; background: rgba(248, 250, 252, 0.5); }
.c-mask-row { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; animation: fadeIn 0.2s ease; }
.c-mask-row input { flex: 1 1 0; padding: 10px 12px; border: 1px solid rgba(203, 213, 225, 0.6); border-radius: 8px; background: rgba(255,255,255,0.8); transition: border-color 0.2s; }
.c-mask-row input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
.c-mask-del { border: none; background: rgba(225, 29, 72, 0.1); color: #e11d48; cursor: pointer; font-weight: 700; padding: 8px 12px; border-radius: 8px; transition: all 0.2s ease; }
.c-mask-del:hover { background: #e11d48; color: #fff; }
`.trim();

/**
 * 클라이언트 스크립트. 외부 참조 없이 인라인 1개.
 * (아우터 TS 템플릿 리터럴과의 충돌을 피해 백틱·\${ 사용 금지)
 */
const CONSOLE_JS = `
"use strict";
var listEl = document.getElementById("project-list");
var formEl = document.getElementById("upload-form");
var nameEl = document.getElementById("project-name");
var ownerEl = document.getElementById("project-owner");
var zipEl = document.getElementById("project-zip");
var submitEl = document.getElementById("upload-submit");
var uploadStatusEl = document.getElementById("upload-status");
var listStatusEl = document.getElementById("list-status");
var tabs = document.querySelectorAll(".c-tab");
var panels = document.querySelectorAll(".c-tabpanel");
var urlNameEl = document.getElementById("url-project-name");
var urlOwnerEl = document.getElementById("url-project-owner");
var originUrlEl = document.getElementById("origin-url");
var urlFormEl = document.getElementById("url-form");
var urlSubmitEl = document.getElementById("url-submit");
var urlStatusEl = document.getElementById("url-status");

function switchTab(index) {
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].setAttribute("aria-selected", i === index ? "true" : "false");
    panels[i].setAttribute("aria-hidden", i === index ? "false" : "true");
  }
}
for (var i = 0; i < tabs.length; i++) {
  (function(idx) {
    tabs[idx].addEventListener("click", function() { switchTab(idx); });
  })(i);
}

function setStatus(el, text, kind) {
  el.textContent = "";
  el.className = "c-status" + (kind ? " is-" + kind : "");
  if (typeof text === "string") { el.textContent = text; }
  else if (text) { el.appendChild(text); }
}

function mockupHref(projectId) {
  // 오리진 하드코딩 금지 (ID-01) — 현재 host 기준 서브도메인
  return location.protocol + "//" + projectId + "." + location.host + "/";
}

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatDate(iso) {
  var d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  function pad(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

function apiErrorMessage(body, fallback) {
  if (body && body.error) {
    if (body.error.code === "TOO_LARGE") {
      return "파일이 너무 큽니다 (최대 200MB). node_modules 등을 제외하고 빌드 결과물만 압축해주세요";
    }
    if (body.error.message) return body.error.message;
  }
  return fallback;
}

async function loadProjects() {
  var res = await fetch("/api/projects");
  if (!res.ok) throw new Error("프로젝트 목록을 불러오지 못했습니다.");
  return res.json();
}

function scenesWithoutSnapshot(project) {
  return project.scenes.filter(function (s) { return !s.snapshotAsset; }).length;
}

function contentDispositionFilename(header, fallback) {
  if (header) {
    var star = header.match(/filename\\*=UTF-8''([^;]+)/i);
    if (star) { try { return decodeURIComponent(star[1]); } catch (e) { /* fallback */ } }
    var plain = header.match(/filename="([^"]+)"/i);
    if (plain) return plain[1];
  }
  return fallback;
}

function isSnippet(project) {
  return project.mockupSource && project.mockupSource.type === "snippet";
}

// 확장(경로 D) 프로젝트의 저장 계열은 Bearer 토큰 필수 — 콘솔은 토큰을 보관하지 않으므로
// (서버도 해시만 가짐) 필요 시 사용자에게 물어 세션에만 둔다. 401이면 지우고 재입력 유도.
function snippetAuthHeaders(project) {
  if (!isSnippet(project)) return {};
  var key = "mockspec:tok:" + project.id;
  var token = sessionStorage.getItem(key);
  if (!token) {
    token = window.prompt("확장 프로젝트 토큰을 붙여넣으세요 (내보내기·마스킹 저장에 필요):");
    if (!token || !token.trim()) return null;
    token = token.trim();
    sessionStorage.setItem(key, token);
  }
  return { "Authorization": "Bearer " + token };
}

function clearSnippetToken(project) {
  sessionStorage.removeItem("mockspec:tok:" + project.id);
}

function handleUnauthorized(project, statusTarget) {
  clearSnippetToken(project);
  setStatus(statusTarget, "토큰이 유효하지 않습니다 — 다시 시도하면 재입력할 수 있습니다. (분실 시 [토큰 재발급])", "error");
}

async function exportProject(project, statusTarget) {
  var missing = scenesWithoutSnapshot(project);
  if (missing > 0) {
    var go = window.confirm(missing + "개 화면에 스냅샷이 없습니다. 산출물에 플레이스홀더로 표시됩니다. 계속할까요?");
    if (!go) return;
  }
  var unmaskedScenes = 0;
  if (project.maskingRules && project.maskingRules.length > 0) {
    for (var i = 0; i < project.scenes.length; i++) {
      if (project.scenes[i].snapshotAsset && !project.scenes[i].maskedSnapshotAsset) {
        unmaskedScenes++;
      }
    }
  }
  if (unmaskedScenes > 0) {
    var goMask = window.confirm("마스킹 규칙이 설정되었으나 적용되지 않은 화면이 " + unmaskedScenes + "개 있습니다. 원본 스냅샷이 유출될 수 있습니다. 계속 내보낼까요?");
    if (!goMask) return;
  }
  var authHeaders = snippetAuthHeaders(project);
  if (authHeaders === null) {
    setStatus(statusTarget, "토큰이 없어 내보내기를 취소했습니다.", "error");
    return;
  }
  setStatus(statusTarget, "내보내는 중…");
  var res = await fetch("/api/projects/" + encodeURIComponent(project.id) + "/export", { method: "POST", headers: authHeaders });
  if (res.status === 401 && isSnippet(project)) {
    handleUnauthorized(project, statusTarget);
    return;
  }
  if (!res.ok) {
    var body = null;
    try { body = await res.json(); } catch (e) { /* 비JSON */ }
    setStatus(statusTarget, apiErrorMessage(body, "내보내기에 실패했습니다."), "error");
    return;
  }
  var blob = await res.blob();
  var filename = contentDispositionFilename(res.headers.get("content-disposition"), project.name + ".html");
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  var note = res.headers.get("x-mockspec-warning") === "EXPORT_TOO_LARGE"
    ? "다운로드됨 — 50MB를 초과해 메일 첨부가 어려울 수 있습니다."
    : "다운로드됨: " + filename;
  setStatus(statusTarget, note, "ok");
  void renderList(); // [T29] 카드의 내보내기 이력 요약 갱신
}

// 연결 코드 = "mockspec:" + base64url(JSON{p,t,s}). 확장(shared/connection.ts)과 형식 동일.
// prj_/tok_/http(s) 모두 ASCII라 btoa로 충분(유니코드 처리 불필요).
function encodeConnection(projectId, token, serverUrl) {
  var json = JSON.stringify({ p: projectId, t: token, s: serverUrl });
  return "mockspec:" + btoa(json).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
}

async function copyConnectionInfo(project) {
  // 팝업은 포커스를 잃으면 닫히므로 값을 하나로 합쳐 "한 번 복사 → 한 번 붙여넣기".
  // 토큰은 서버가 해시만 보관 — 이 세션에서 발급·재발급·입력한 값이 있을 때만 코드를 만든다.
  var token = sessionStorage.getItem("mockspec:tok:" + project.id);
  if (!token) {
    setStatus(listStatusEl, "토큰이 이 세션에 없습니다 — [토큰 재발급]을 먼저 누르면 연결 코드가 만들어집니다.", "error");
    return;
  }
  var code = encodeConnection(project.id, token, location.origin);
  try {
    await navigator.clipboard.writeText(code);
    setStatus(listStatusEl, "연결 코드를 복사했습니다 — 확장 팝업의 [연결 코드 붙여넣기]에 붙여넣고 [연결]을 누르세요.", "ok");
  } catch (e) {
    setStatus(listStatusEl, "복사 실패 — 연결 코드: " + code, "error");
  }
}

async function reissueToken(project) {
  var go = window.confirm("토큰을 재발급하면 기존 토큰이 즉시 무효화됩니다. 확장도 새 토큰으로 다시 연결해야 합니다. 계속할까요?");
  if (!go) return;
  var res = await fetch("/api/projects/" + encodeURIComponent(project.id) + "/token", { method: "POST" });
  if (!res.ok) {
    setStatus(listStatusEl, "토큰 재발급에 실패했습니다.", "error");
    return;
  }
  var data = await res.json();
  sessionStorage.setItem("mockspec:tok:" + project.id, data.token);
  // 새 토큰으로 연결 코드를 즉시 복사 — 확장에 붙여넣어 재연결.
  var code = encodeConnection(project.id, data.token, location.origin);
  try {
    await navigator.clipboard.writeText(code);
    setStatus(listStatusEl, "토큰 재발급 + 새 연결 코드를 복사했습니다 — 확장 팝업에 붙여넣고 [연결].", "ok");
  } catch (e) {
    window.prompt("새 연결 코드 (복사해 확장 팝업에 붙여넣으세요):", code);
    setStatus(listStatusEl, "토큰이 재발급되었습니다.", "ok");
  }
}

async function deleteProject(project) {
  // 이름·작성자를 함께 보여 남의 프로젝트 오삭제를 방지한다 (POL-M09 — 인증 없는 대신 확인 강화)
  var who = project.ownerLabel ? " (작성자: " + project.ownerLabel + ")" : "";
  var go = window.confirm("'" + project.name + "'" + who + " 프로젝트와 모든 화면·어노테이션이 삭제됩니다. 되돌릴 수 없습니다.");
  if (!go) return;
  var res = await fetch("/api/projects/" + encodeURIComponent(project.id), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    setStatus(listStatusEl, "삭제에 실패했습니다.", "error");
    return;
  }
  await renderList();
}

function renderProject(project) {
  var card = el("div", "c-project");
  var head = el("div", "c-project-head");
  var title = el("span", "c-project-name", project.name);
  var srcType = project.mockupSource ? project.mockupSource.type : "upload";
  var badgeLabel = srcType === "proxy" ? "URL 프록시" : srcType === "snippet" ? "확장" : "ZIP 업로드";
  title.appendChild(el("span", "c-badge", badgeLabel));
  head.appendChild(title);
  var metaText = (project.ownerLabel ? project.ownerLabel + " · " : "") +
    "화면 " + project.scenes.length + " · 어노테이션 " + project.annotations.length +
    " · " + formatDate(project.updatedAt) + " 수정";
  // [T29] 산출물 이력 요약 — 목록 응답의 exportCount·lastExportAt (0회면 미표시)
  if (project.exportCount > 0) {
    metaText += " · 내보내기 " + project.exportCount + "회 (" + formatDate(project.lastExportAt) + ")";
  }
  if (srcType === "proxy") metaText += " · " + project.mockupSource.originUrl;
  if (srcType === "snippet" && project.mockupSource.lastSeenOrigin) {
    metaText += " · " + project.mockupSource.lastSeenOrigin;
  }
  head.appendChild(el("span", "c-project-meta", metaText));
  card.appendChild(head);

  // 확장 프로젝트는 팝업에 프로젝트 ID를 넣어야 연결된다 — ID를 항상 보이게(이름과 혼동 방지).
  if (srcType === "snippet") {
    var idRow = el("div", "c-project-id");
    idRow.appendChild(el("span", "c-id-label", "프로젝트 ID"));
    idRow.appendChild(el("code", null, project.id));
    card.appendChild(idRow);
  }

  var actions = el("div", "c-project-actions");
  if (srcType !== "snippet") {
    // 확장 프로젝트는 서비스가 서빙하는 목업 URL이 없다 — 편집은 대상 화면에서 확장으로.
    var openLink = el("a", "c-btn c-btn-ghost", "편집 열기");
    openLink.href = mockupHref(project.id);
    openLink.target = "_blank";
    openLink.rel = "noopener";
    actions.appendChild(openLink);
  } else {
    var copyBtn = el("button", "c-btn c-btn-ghost", "연결 코드 복사");
    copyBtn.type = "button";
    copyBtn.addEventListener("click", function () { void copyConnectionInfo(project); });
    actions.appendChild(copyBtn);

    var reissueBtn = el("button", "c-btn c-btn-ghost", "토큰 재발급");
    reissueBtn.type = "button";
    reissueBtn.addEventListener("click", function () { void reissueToken(project); });
    actions.appendChild(reissueBtn);
  }

  var exportBtn = el("button", "c-btn c-btn-ghost", "내보내기");
  exportBtn.type = "button";
  exportBtn.addEventListener("click", function () { void exportProject(project, listStatusEl); });
  actions.appendChild(exportBtn);

  var maskBtn = el("button", "c-btn c-btn-ghost", "마스킹 편집");
  maskBtn.type = "button";
  maskBtn.addEventListener("click", function () { openMaskingModal(project); });
  actions.appendChild(maskBtn);

  var deleteBtn = el("button", "c-btn c-btn-danger", "삭제");
  deleteBtn.type = "button";
  deleteBtn.addEventListener("click", function () { void deleteProject(project); });
  actions.appendChild(deleteBtn);

  card.appendChild(actions);
  return card;
}

async function renderList() {
  try {
    var projects = await loadProjects();
    listEl.textContent = "";
    if (projects.length === 0) {
      listEl.appendChild(el("div", "c-empty", "아직 프로젝트가 없습니다. 위에서 zip 업로드·URL 등록·확장 중 하나로 시작하세요."));
      return;
    }
    for (var i = 0; i < projects.length; i += 1) listEl.appendChild(renderProject(projects[i]));
  } catch (err) {
    setStatus(listStatusEl, err && err.message ? err.message : "목록을 불러오지 못했습니다.", "error");
  }
}

function excludedSummary(extract) {
  if (!extract || !extract.excluded || extract.excluded.length === 0) return "";
  var parts = extract.excluded.map(function (e) {
    return e.pattern + " (" + e.count.toLocaleString() + "개 파일)";
  });
  return " 제외됨: " + parts.join(", ") + ".";
}

function strippedRootSummary(extract) {
  if (!extract || !extract.strippedRoot) return "";
  return " 최상위 폴더 '" + extract.strippedRoot + "/'를 벗겨 해제했습니다.";
}

formEl.addEventListener("submit", function (event) {
  event.preventDefault();
  var file = zipEl.files && zipEl.files[0];
  if (!file) {
    setStatus(uploadStatusEl, "zip 파일을 선택해주세요.", "error");
    return;
  }
  var form = new FormData();
  form.append("name", nameEl.value.trim());
  if (ownerEl.value.trim()) form.append("ownerLabel", ownerEl.value.trim());
  form.append("zip", file);

  submitEl.disabled = true;
  setStatus(uploadStatusEl, "업로드 중…");
  fetch("/api/projects", { method: "POST", body: form })
    .then(async function (res) {
      if (!res.ok) {
        var body = null;
        try { body = await res.json(); } catch (e) { /* 비JSON */ }
        throw new Error(apiErrorMessage(body, "업로드에 실패했습니다. zip 파일을 확인해주세요."));
      }
      return res.json();
    })
    .then(function (result) {
      formEl.reset();
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(
        "업로드 완료: " + result.project.name + "." + excludedSummary(result.extract) + strippedRootSummary(result.extract) + " "));
      var link = el("a", null, "편집 열기 →");
      link.href = mockupHref(result.project.id);
      link.target = "_blank";
      link.rel = "noopener";
      frag.appendChild(link);
      setStatus(uploadStatusEl, frag, "ok");
      return renderList();
    })
    .catch(function (err) {
      setStatus(uploadStatusEl, err && err.message ? err.message : "업로드에 실패했습니다.", "error");
    })
    .finally(function () { submitEl.disabled = false; });
});

var snippetFormEl = document.getElementById("snippet-form");
var snippetNameEl = document.getElementById("snippet-project-name");
var snippetOwnerEl = document.getElementById("snippet-project-owner");
var snippetSubmitEl = document.getElementById("snippet-submit");
var snippetStatusEl = document.getElementById("snippet-status");
var snippetResultEl = document.getElementById("snippet-result");
var snippetTokenEl = document.getElementById("snippet-token");
var snippetProjectIdEl = document.getElementById("snippet-project-id");
var snippetCopyEl = document.getElementById("snippet-copy");

snippetFormEl.addEventListener("submit", function (event) {
  event.preventDefault();
  var name = snippetNameEl.value.trim();
  if (!name) {
    setStatus(snippetStatusEl, "프로젝트 이름을 입력해주세요.", "error");
    return;
  }
  snippetSubmitEl.disabled = true;
  snippetResultEl.hidden = true;
  setStatus(snippetStatusEl, "프로젝트 생성 중…");
  fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, source: "snippet", ownerLabel: snippetOwnerEl.value.trim() || undefined })
  })
    .then(async function (res) {
      if (!res.ok) {
        var body = null;
        try { body = await res.json(); } catch (e) { /* 비JSON */ }
        throw new Error(apiErrorMessage(body, "생성에 실패했습니다."));
      }
      return res.json();
    })
    .then(function (result) {
      snippetFormEl.reset();
      // 세션에 토큰 보관 — 목록 [연결 코드 복사]·내보내기·마스킹이 재사용
      sessionStorage.setItem("mockspec:tok:" + result.project.id, result.token);
      snippetTokenEl.textContent = encodeConnection(result.project.id, result.token, location.origin);
      snippetProjectIdEl.textContent = result.project.id;
      snippetResultEl.hidden = false;
      setStatus(snippetStatusEl, "생성 완료: " + result.project.name + " — 아래 [연결 코드 복사] 후 확장 팝업에 붙여넣으세요.", "ok");
      return renderList();
    })
    .catch(function (err) {
      setStatus(snippetStatusEl, err && err.message ? err.message : "생성에 실패했습니다.", "error");
    })
    .finally(function () { snippetSubmitEl.disabled = false; });
});

snippetCopyEl.addEventListener("click", function () {
  var code = snippetTokenEl.textContent || "";
  if (!code) return;
  navigator.clipboard.writeText(code).then(function () {
    setStatus(snippetStatusEl, "연결 코드를 복사했습니다 — 확장 팝업에 붙여넣고 [연결].", "ok");
  }, function () {
    setStatus(snippetStatusEl, "복사에 실패했습니다 — 연결 코드를 드래그해 직접 복사하세요.", "error");
  });
});

urlFormEl.addEventListener("submit", function (event) {
  event.preventDefault();
  var name = urlNameEl.value.trim();
  var originUrl = originUrlEl.value.trim();
  if (!name || !originUrl) {
    setStatus(urlStatusEl, "모든 필드를 입력해주세요.", "error");
    return;
  }

  urlSubmitEl.disabled = true;
  setStatus(urlStatusEl, "오리진 도달성 확인 및 등록 중…");
  fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, originUrl: originUrl, ownerLabel: urlOwnerEl.value.trim() || undefined })
  })
    .then(async function (res) {
      if (!res.ok) {
        var body = null;
        try { body = await res.json(); } catch (e) { /* 비JSON */ }
        throw new Error(apiErrorMessage(body, "등록에 실패했습니다."));
      }
      return res.json();
    })
    .then(function (result) {
      urlFormEl.reset();
      var frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode("등록 완료: " + result.project.name + " "));
      var link = el("a", null, "편집 열기 →");
      link.href = mockupHref(result.project.id);
      link.target = "_blank";
      link.rel = "noopener";
      frag.appendChild(link);
      setStatus(urlStatusEl, frag, "ok");
      return renderList();
    })
    .catch(function (err) {
      setStatus(urlStatusEl, err && err.message ? err.message : "등록에 실패했습니다.", "error");
    })
    .finally(function () { urlSubmitEl.disabled = false; });
});

var maskingModalEl = document.getElementById("masking-modal");
var maskingProjectNameEl = document.getElementById("masking-project-name");
var maskingRulesEl = document.getElementById("masking-rules");
var maskingAddBtn = document.getElementById("masking-add");
var maskingCloseBtn = document.getElementById("masking-close");
var maskingCancelBtn = document.getElementById("masking-cancel");
var maskingApplyBtn = document.getElementById("masking-apply");
var maskingStatusEl = document.getElementById("masking-status");
var currentMaskingProject = null;

function renderMaskingRow(rule) {
  var row = el("div", "c-mask-row");
  var findInput = el("input");
  findInput.type = "text";
  findInput.placeholder = "찾을 문자열 (예: 홍길동)";
  findInput.value = rule.find || "";
  var replaceInput = el("input");
  replaceInput.type = "text";
  replaceInput.placeholder = "치환할 문자열 (예: 고객A)";
  replaceInput.value = rule.replace || "";
  var delBtn = el("button", "c-mask-del", "X");
  delBtn.type = "button";
  delBtn.addEventListener("click", function() { row.remove(); });
  row.appendChild(findInput);
  row.appendChild(replaceInput);
  row.appendChild(delBtn);
  maskingRulesEl.appendChild(row);
}

function openMaskingModal(project) {
  currentMaskingProject = project;
  maskingProjectNameEl.textContent = project.name;
  maskingRulesEl.textContent = "";
  setStatus(maskingStatusEl, "");
  var rules = project.maskingRules || [];
  for (var i = 0; i < rules.length; i++) {
    renderMaskingRow(rules[i]);
  }
  maskingModalEl.classList.add("is-open");
}

function closeMaskingModal() {
  maskingModalEl.classList.remove("is-open");
  currentMaskingProject = null;
}

maskingCloseBtn.addEventListener("click", closeMaskingModal);
maskingCancelBtn.addEventListener("click", closeMaskingModal);
maskingAddBtn.addEventListener("click", function() { renderMaskingRow({ find: "", replace: "" }); });

function applyMaskingText(text, rules) {
  var res = text;
  for (var i = 0; i < rules.length; i++) {
    if (!rules[i].find) continue;
    res = res.split(rules[i].find).join(rules[i].replace || "");
  }
  return res;
}

function walkDOM(node, rules) {
  if (node.nodeType === Node.TEXT_NODE) {
    if (node.nodeValue) {
      node.nodeValue = applyMaskingText(node.nodeValue, rules);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    var attrs = ["value", "placeholder", "title", "alt", "aria-label"];
    for (var i = 0; i < attrs.length; i++) {
      if (node.hasAttribute(attrs[i])) {
        var val = node.getAttribute(attrs[i]);
        if (val) node.setAttribute(attrs[i], applyMaskingText(val, rules));
      }
    }
    var child = node.firstChild;
    while (child) {
      walkDOM(child, rules);
      child = child.nextSibling;
    }
  }
}

maskingApplyBtn.addEventListener("click", async function() {
  if (!currentMaskingProject) return;
  var rows = maskingRulesEl.querySelectorAll(".c-mask-row");
  var newRules = [];
  for (var i = 0; i < rows.length; i++) {
    var inputs = rows[i].querySelectorAll("input");
    var findVal = inputs[0].value;
    var replaceVal = inputs[1].value;
    if (findVal) {
      newRules.push({ id: "msk_" + Math.random().toString(36).substring(2, 12), find: findVal, replace: replaceVal });
    }
  }
  
  var maskAuthHeaders = snippetAuthHeaders(currentMaskingProject);
  if (maskAuthHeaders === null) {
    setStatus(maskingStatusEl, "토큰이 없어 적용을 취소했습니다.", "error");
    return;
  }
  maskingApplyBtn.disabled = true;
  setStatus(maskingStatusEl, "스냅샷에 마스킹을 적용하는 중…");
  try {
    var updatedProject = JSON.parse(JSON.stringify(currentMaskingProject));
    updatedProject.maskingRules = newRules;
    
    var parser = new DOMParser();
    for (var i = 0; i < updatedProject.scenes.length; i++) {
      var scene = updatedProject.scenes[i];
      if (!scene.snapshotAsset) continue;
      
      var assetRes = await fetch("/api/projects/" + updatedProject.id + "/assets/" + scene.snapshotAsset);
      if (!assetRes.ok) throw new Error("스냅샷을 불러오지 못했습니다.");
      var html = await assetRes.text();
      
      if (newRules.length > 0) {
        var doc = parser.parseFromString(html, "text/html");
        walkDOM(doc.body, newRules);
        var maskedHtml = "<!doctype html>\\n" + doc.documentElement.outerHTML;
        var blob = new Blob([maskedHtml], { type: "text/html" });
        var fd = new FormData();
        fd.append("snapshot", blob);
        
        var uploadRes = await fetch("/api/projects/" + updatedProject.id + "/assets", { method: "POST", headers: maskAuthHeaders, body: fd });
        if (uploadRes.status === 401) { handleUnauthorized(updatedProject, maskingStatusEl); return; }
        if (!uploadRes.ok) throw new Error("마스킹된 스냅샷 저장 실패");
        var uploadData = await uploadRes.json();
        scene.maskedSnapshotAsset = uploadData.assetKey;
        scene.maskedAt = new Date().toISOString();
      } else {
        delete scene.maskedSnapshotAsset;
        delete scene.maskedAt;
      }
    }
    
    var putRes = await fetch("/api/projects/" + updatedProject.id, {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, maskAuthHeaders),
      body: JSON.stringify(updatedProject)
    });
    if (putRes.status === 401) { handleUnauthorized(updatedProject, maskingStatusEl); return; }
    if (!putRes.ok) throw new Error("프로젝트 정보 갱신 실패");
    
    closeMaskingModal();
    renderList();
  } catch (err) {
    setStatus(maskingStatusEl, err.message || "오류가 발생했습니다.", "error");
  } finally {
    maskingApplyBtn.disabled = false;
  }
});

void renderList();
`.trim();

export const CONSOLE_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${WORKING_NAME} 콘솔</title>
  <style>${CONSOLE_CSS}</style>
</head>
<body>
  <div class="c-shell">
    <h1 class="c-title">${WORKING_NAME}</h1>

    <section class="c-card">
      <h2>새 프로젝트 시작</h2>
      <div class="c-tabs" role="tablist">
        <button type="button" class="c-tab" role="tab" aria-selected="true">ZIP 업로드</button>
        <button type="button" class="c-tab" role="tab" aria-selected="false">URL 등록</button>
        <button type="button" class="c-tab" role="tab" aria-selected="false">내 화면에서 편집 (확장)</button>
      </div>

      <div class="c-tabpanel" role="tabpanel" aria-hidden="false">
        <form id="upload-form">
          <div class="c-row">
            <label for="project-name">프로젝트 이름</label>
            <input id="project-name" type="text" name="name" placeholder="예: 주문 개편 목업">
          </div>
          <div class="c-row">
            <label for="project-owner">작성자 (선택)</label>
            <input id="project-owner" type="text" placeholder="예: 김기획 — 표시용, 인증 아님">
          </div>
          <div class="c-row">
            <label for="project-zip">빌드 zip</label>
            <input id="project-zip" type="file" name="zip" accept=".zip,application/zip" required>
          </div>
          <p class="c-hint">
            빌드 결과물 폴더(dist 등)만 압축해주세요. node_modules가 포함되면 파일이 커져
            업로드가 거부될 수 있습니다 (제한 200MB — 압축 파일 기준).<br>
            ⓘ SPA는 상대 base(vite build --base ./) 또는 루트 base 빌드만 지원합니다.
          </p>
          <button id="upload-submit" class="c-btn" type="submit">업로드하고 시작</button>
          <p id="upload-status" class="c-status"></p>
        </form>
      </div>

      <div class="c-tabpanel" role="tabpanel" aria-hidden="true">
        <form id="url-form">
          <div class="c-row">
            <label for="url-project-name">프로젝트 이름</label>
            <input id="url-project-name" type="text" placeholder="예: 스테이징 환경 목업" required>
          </div>
          <div class="c-row">
            <label for="url-project-owner">작성자 (선택)</label>
            <input id="url-project-owner" type="text" placeholder="예: 김기획 — 표시용, 인증 아님">
          </div>
          <div class="c-row">
            <label for="origin-url">오리진 URL</label>
            <input id="origin-url" type="text" placeholder="예: https://staging.mockup.internal" required>
          </div>
          <p class="c-hint">
            이미 배포된 스테이징이나 개발 서버 URL을 입력하세요. 서버가 도달 가능한 허용된 도메인이어야 합니다.<br>
            ⓘ WebSocket 기반 HMR이나 SSO 리다이렉트가 필수인 환경은 정상 동작하지 않을 수 있습니다.
          </p>
          <button id="url-submit" class="c-btn" type="submit">URL 등록하고 시작</button>
          <p id="url-status" class="c-status"></p>
        </form>
      </div>

      <div class="c-tabpanel" role="tabpanel" aria-hidden="true">
        <form id="snippet-form">
          <div class="c-row">
            <label for="snippet-project-name">프로젝트 이름</label>
            <input id="snippet-project-name" type="text" placeholder="예: 주문 어드민 (로그인 뒤 화면)" required>
          </div>
          <div class="c-row">
            <label for="snippet-project-owner">작성자 (선택)</label>
            <input id="snippet-project-owner" type="text" placeholder="예: 김기획 — 표시용, 인증 아님">
          </div>
          <p class="c-hint">
            로그인해야 보이는 화면(SSO 포함)이나 로컬에서만 도는 목업용입니다.
            브라우저 확장이 지금 보고 있는 화면 위에 편집기를 띄우고, 저장은 프로젝트 토큰으로 인증합니다.<br>
            ⓘ 등록하면 <b>연결 코드</b>(ID·토큰·서버 주소를 합친 값)가 <b>한 번만</b> 표시됩니다 — 복사해 확장 팝업에 붙여넣으세요.
          </p>
          <button id="snippet-submit" class="c-btn" type="submit">프로젝트 만들고 연결 코드 받기</button>
          <p id="snippet-status" class="c-status"></p>
          <div id="snippet-result" class="c-snippet-result" hidden>
            <p><b>연결 코드</b> (이 화면을 벗어나면 다시 볼 수 없습니다 — 분실 시 [토큰 재발급]):</p>
            <div class="c-token-row">
              <code id="snippet-token"></code>
              <button type="button" id="snippet-copy" class="c-btn c-btn-ghost">복사</button>
            </div>
            <p class="c-hint">
              연결 방법: ① Chrome/Edge에서 <code>chrome://extensions</code> → 개발자 모드 →
              [압축해제된 확장 프로그램 로드]로 mockspec 확장을 설치(<code>packages/extension/dist</code>)
              ② 대상 화면을 열고 확장 팝업의 <b>[연결 코드 붙여넣기]</b>에 위 코드를 붙여넣고 [연결]
              ③ 새로고침하면 화면에 편집 버튼(FAB)이 나타납니다. (프로젝트 ID: <code id="snippet-project-id"></code>)
            </p>
          </div>
        </form>
      </div>
    </section>

    <section class="c-card">
      <h2>프로젝트 목록</h2>
      <div id="project-list" class="c-list"></div>
      <p id="list-status" class="c-status"></p>
    </section>

    <div id="masking-modal" class="c-modal-overlay">
      <div class="c-modal">
        <div class="c-modal-header">
          <h2>마스킹 편집: <span id="masking-project-name"></span></h2>
          <button type="button" id="masking-close" class="c-btn c-btn-ghost">닫기</button>
        </div>
        <div class="c-modal-body">
          <p class="c-hint">스냅샷에 포함된 실데이터(고객명, 이메일 등)를 부분 일치로 찾아 치환합니다. 규칙은 전체 화면에 일괄 적용됩니다.</p>
          <div id="masking-rules"></div>
          <button type="button" id="masking-add" class="c-btn c-btn-ghost">+ 규칙 추가</button>
          <p id="masking-status" class="c-status"></p>
        </div>
        <div class="c-modal-footer">
          <button type="button" id="masking-cancel" class="c-btn c-btn-ghost">취소</button>
          <button type="button" id="masking-apply" class="c-btn">전체 화면에 적용 및 저장</button>
        </div>
      </div>
    </div>
  </div>
  <script>${CONSOLE_JS}</script>
</body>
</html>`;

/** 루트 도메인 `/`의 콘솔 응답. */
export function consolePage(_req: Request, res: Response): void {
  res.status(200).type("text/html; charset=utf-8").send(CONSOLE_HTML);
}
