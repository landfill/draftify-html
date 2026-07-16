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
  --c-label-w: 120px;
  --c-row-gap: 10px;
  color-scheme: light;
  font-family: Pretendard, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #0f172a;
  background: #f8fafc;
  min-height: 100vh;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; min-height: 100vh; background: transparent; font-size: 11.5px; line-height: 1.5; }
button, input { font: inherit; }

.c-header {
  display: flex; justify-content: space-between; align-items: center;
  height: 56px; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0 32px;
}
.c-logo { font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px; }
.c-header-right { display: flex; gap: 24px; align-items: center; }
.c-nav-link { font-size: 13px; color: #475569; text-decoration: none; font-weight: 500; }
.c-nav-link:hover { color: #0f172a; }

.c-shell { max-width: 1080px; margin: 0 auto; padding: 48px 32px 80px; }
.c-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  padding: 28px 32px;
  margin-bottom: 32px;
}
.c-section { margin-bottom: 36px; }
.c-section-title { display: flex; align-items: center; gap: 8px; margin: 0 0 12px 4px; font-size: 13px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px; }
.c-count { display: inline-block; min-width: 20px; padding: 0 7px; border-radius: 999px; background: #e2e8f0; color: #475569; font-size: 10.5px; font-weight: 600; line-height: 19px; text-align: center; }
.c-count:empty { display: none; }
.c-card-flush { padding: 6px 32px; }
.c-row { display: flex; gap: var(--c-row-gap); align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.c-row label { flex: 0 0 var(--c-label-w); font-size: 11.5px; font-weight: 500; color: #475569; text-align: right; }
.c-row input[type="text"], .c-row input[type="file"] {
  flex: 1 1 0; min-width: 240px; max-width: 400px;
  padding: 7px 10px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-size: 11.5px;
}
.c-row input[type="text"]:focus, .c-row input[type="file"]:focus {
  outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
.c-hint { margin: 6px 0 18px calc(var(--c-label-w) + var(--c-row-gap)); color: #64748b; font-size: 11px; line-height: 1.55; max-width: 640px; }
.c-btn {
  padding: 6px 12px; border: none; border-radius: 6px; text-decoration: none; display: inline-block;
  background: #4f46e5; color: #fff; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;
}
.c-btn:hover:not(:disabled) { background: #4338ca; }
.c-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.c-btn.c-btn-ghost { background: #fff; color: #334155; border: 1px solid #cbd5e1; font-weight: 500; }
.c-btn.c-btn-ghost:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; color: #0f172a; }
.c-btn.c-btn-danger { background: #fff; color: #e11d48; border: 1px solid #fecdd3; font-weight: 500; }
.c-btn.c-btn-danger:hover:not(:disabled) { background: #fff1f2; border-color: #fda4af; }
form > .c-btn[type="submit"] { margin-left: calc(var(--c-label-w) + var(--c-row-gap)); }
.c-status { margin: 14px 0 0; font-size: 11.5px; line-height: 1.5; padding: 8px 12px; border-radius: 6px; display: none; }
.c-status:not(:empty) { display: block; }
.c-status.is-error { color: #be123c; background: #fff1f2; border: 1px solid #fecdd3; }
.c-status.is-ok { color: #15803d; background: #f0fdf4; border: 1px solid #bbf7d0; }
.c-status a { color: #4f46e5; font-weight: 600; text-decoration: none; }
.c-status a:hover { text-decoration: underline; }

.c-list { display: flex; flex-direction: column; }
.c-project { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 18px 4px; border-bottom: 1px solid #f1f5f9; transition: background 0.15s ease; }
.c-project:last-child { border-bottom: none; }
.c-project:hover { background: #f8fafc; }
.c-project-info { display: flex; flex-direction: column; gap: 5px; flex: 1 1 0; min-width: 0; }
.c-project-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.c-project-name { font-weight: 600; font-size: 12.5px; color: #0f172a; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
a.c-project-name:hover { color: #4f46e5; text-decoration: underline; }
.c-badge { flex: 0 0 auto; padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 500; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
.c-project-meta { color: #94a3b8; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.c-id-code { padding: 1px 6px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #64748b; user-select: all; }
.c-project-actions { display: flex; gap: 6px; flex: 0 0 auto; }
.c-project-actions .c-btn { padding: 4px 10px; font-size: 11px; background: #fff; border: 1px solid #cbd5e1; color: #334155; font-weight: 500; }
.c-project-actions .c-btn:hover:not(:disabled) { background: #f8fafc; border-color: #94a3b8; color: #0f172a; }
.c-project-actions .c-btn.c-btn-danger { color: #e11d48; border-color: #fecdd3; }
.c-project-actions .c-btn.c-btn-danger:hover:not(:disabled) { background: #fff1f2; border-color: #fda4af; }
.c-empty { color: #64748b; padding: 40px 20px; text-align: center; font-size: 11.5px; }

.c-tabs { display: flex; gap: 4px; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
.c-tab { padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-weight: 500; font-size: 11.5px; color: #64748b; border-bottom: 2px solid transparent; transition: color 0.15s ease, border-color 0.15s ease; margin-bottom: -1px; }
.c-tab:hover { color: #334155; }
.c-tab[aria-selected="true"] { color: #4f46e5; border-bottom-color: #4f46e5; font-weight: 600; }
.c-tabpanel { display: none; }
.c-tabpanel[aria-hidden="false"] { display: block; animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }

.c-snippet-result { margin-top: 16px; padding: 14px 16px; border: 1px solid #bbf7d0; border-radius: 8px; background: #f0fdf4; }
.c-snippet-result > p { margin: 0 0 4px; font-size: 11.5px; }
.c-token-row { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
.c-token-row code { flex: 1; padding: 6px 10px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; word-break: break-all; user-select: all; }
.c-snippet-result .c-hint { margin-left: 0; }

.c-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.5); display: none; place-items: center; z-index: 100; }
.c-modal-overlay.is-open { display: grid; }
.c-modal { background: #fff; width: 600px; max-width: 90vw; max-height: 90vh; border-radius: 10px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.15); }
.c-modal-header { padding: 16px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
.c-modal-header h2 { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; }
.c-modal-body { padding: 20px; overflow-y: auto; flex: 1 1 auto; }
.c-modal-body .c-hint { margin-left: 0; }
.c-modal-footer { padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 8px; background: #f8fafc; }
.c-mask-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.c-mask-row input { flex: 1 1 0; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11.5px; }
.c-mask-del { border: none; background: #fff1f2; color: #e11d48; cursor: pointer; font-weight: 700; padding: 4px 9px; border-radius: 6px; font-size: 11.5px; }
.c-mask-del:hover { background: #e11d48; color: #fff; }
`.trim();

/**
 * 클라이언트 스크립트. 외부 참조 없이 인라인 1개.
 * (아우터 TS 템플릿 리터럴과의 충돌을 피해 백틱·\${ 사용 금지)
 */
const CONSOLE_JS = `
"use strict";
var listEl = document.getElementById("project-list");
var countEl = document.getElementById("project-count");
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

  var info = el("div", "c-project-info");

  var srcType = project.mockupSource ? project.mockupSource.type : "upload";
  var badgeLabel = srcType === "proxy" ? "URL 프록시" : srcType === "snippet" ? "확장" : "ZIP 업로드";

  // 제목줄: 이름(제목, 편집으로 가는 링크) + 등록 방식 배지. 이름 길이와 무관하게 배지가 바로 옆에 붙는다.
  var titleRow = el("div", "c-project-title");
  if (srcType !== "snippet") {
    var nameLink = el("a", "c-project-name", project.name);
    nameLink.href = mockupHref(project.id);
    nameLink.target = "_blank";
    nameLink.rel = "noopener";
    titleRow.appendChild(nameLink);
  } else {
    // 확장 프로젝트는 서브도메인 편집 URL이 없다 — 이름은 텍스트로만
    titleRow.appendChild(el("span", "c-project-name", project.name));
  }
  titleRow.appendChild(el("span", "c-badge", badgeLabel));
  info.appendChild(titleRow);

  var metaText = (project.ownerLabel ? project.ownerLabel + " · " : "") +
    "화면 " + project.scenes.length + " · 어노테이션 " + project.annotations.length +
    " · " + formatDate(project.updatedAt) + " 수정";
  if (project.exportCount > 0) {
    metaText += " · 내보내기 " + project.exportCount + "회";
    // lastExportAt 부재 시 "(undefined)" 노출 방지 — 값이 있을 때만 괄호 표기
    if (project.lastExportAt) {
      metaText += " (" + formatDate(project.lastExportAt) + ")";
    }
  }
  if (srcType === "proxy") metaText += " · " + project.mockupSource.originUrl;
  if (srcType === "snippet" && project.mockupSource.lastSeenOrigin) {
    metaText += " · " + project.mockupSource.lastSeenOrigin;
  }
  var meta = el("span", "c-project-meta");
  if (srcType === "snippet") {
    // ID는 연결 코드 대상 확인용 — 확장 프로젝트만 메타줄에 노출 (실사용: 이름/ID 혼동 방지).
    // 맨 앞에 둬야 긴 origin에 밀려 ellipsis로 잘리지 않는다.
    meta.appendChild(el("code", "c-project-id c-id-code", project.id));
    meta.appendChild(document.createTextNode(" · "));
  }
  meta.appendChild(document.createTextNode(metaText));
  info.appendChild(meta);

  card.appendChild(info);

  var actions = el("div", "c-project-actions");
  if (srcType !== "snippet") {
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
    if (countEl) countEl.textContent = String(projects.length);
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
  <header class="c-header">
    <div class="c-header-left">
      <span class="c-logo">${WORKING_NAME}</span>
    </div>
    <div class="c-header-right">
      <a href="#" class="c-nav-link">사용 가이드</a>
      <a href="#" class="c-nav-link">DOCS</a>
      <a href="#" class="c-nav-link">FAQ</a>
      <a href="#" class="c-nav-link">EN</a>
    </div>
  </header>
  <div class="c-shell">
    <section class="c-section">
      <h2 class="c-section-title">새 프로젝트 시작</h2>
      <div class="c-card">
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
      </div>
    </section>

    <section class="c-section">
      <h2 class="c-section-title">프로젝트 목록<span id="project-count" class="c-count"></span></h2>
      <div class="c-card c-card-flush">
        <div id="project-list" class="c-list"></div>
        <p id="list-status" class="c-status"></p>
      </div>
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
