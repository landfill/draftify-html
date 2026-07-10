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
  color: #202124;
  background: #f7f8f9;
}
* { box-sizing: border-box; }
body { margin: 0; background: #f7f8f9; }
button, input { font: inherit; }
.c-shell { max-width: 760px; margin: 0 auto; padding: 24px 20px 48px; }
.c-title { margin: 0 0 20px; font-size: 22px; font-weight: 700; }
.c-card { background: #fff; border: 1px solid #dfe3e7; border-radius: 10px; padding: 18px; margin-bottom: 20px; }
.c-card h2 { margin: 0 0 14px; font-size: 15px; }
.c-row { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.c-row label { flex: 0 0 110px; font-size: 13px; color: #5f6368; }
.c-row input[type="text"] { flex: 1 1 220px; padding: 8px 10px; border: 1px solid #c7cdd3; border-radius: 6px; }
.c-hint { margin: 4px 0 12px; color: #5f6368; font-size: 12.5px; line-height: 1.5; }
.c-btn {
  padding: 8px 14px; border: 1px solid #1a73e8; border-radius: 6px;
  background: #1a73e8; color: #fff; font-weight: 700; cursor: pointer;
}
.c-btn:disabled { opacity: .5; cursor: default; }
.c-btn.c-btn-ghost { background: #fff; color: #1a73e8; }
.c-btn.c-btn-danger { border-color: #d93025; background: #fff; color: #d93025; }
.c-status { margin: 10px 0 0; font-size: 13px; line-height: 1.5; }
.c-status.is-error { color: #d93025; font-weight: 700; }
.c-status.is-ok { color: #188038; }
.c-status a { color: #1a73e8; }
.c-list { display: grid; gap: 10px; }
.c-project { border: 1px solid #dfe3e7; border-radius: 8px; padding: 12px 14px; background: #fff; }
.c-project-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; flex-wrap: wrap; }
.c-project-name { font-weight: 700; overflow-wrap: anywhere; }
.c-project-meta { color: #5f6368; font-size: 12.5px; white-space: nowrap; }
.c-project-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
.c-empty { color: #5f6368; padding: 18px; text-align: center; border: 1px dashed #c7cdd3; border-radius: 8px; }
.c-tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid #dfe3e7; }
.c-tab { padding: 8px 16px; border: none; background: transparent; cursor: pointer; font-weight: 700; color: #5f6368; border-bottom: 2px solid transparent; }
.c-tab[aria-selected="true"] { color: #1a73e8; border-bottom-color: #1a73e8; }
.c-tabpanel { display: none; }
.c-tabpanel[aria-hidden="false"] { display: block; }
.c-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; background: #e8f0fe; color: #1a73e8; vertical-align: top; margin-left: 6px; }
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
var zipEl = document.getElementById("project-zip");
var submitEl = document.getElementById("upload-submit");
var uploadStatusEl = document.getElementById("upload-status");
var listStatusEl = document.getElementById("list-status");
var tabs = document.querySelectorAll(".c-tab");
var panels = document.querySelectorAll(".c-tabpanel");
var urlNameEl = document.getElementById("url-project-name");
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

async function exportProject(project, statusTarget) {
  var missing = scenesWithoutSnapshot(project);
  if (missing > 0) {
    var go = window.confirm(missing + "개 장면에 스냅샷이 없습니다. 산출물에 플레이스홀더로 표시됩니다. 계속할까요?");
    if (!go) return;
  }
  setStatus(statusTarget, "내보내는 중…");
  var res = await fetch("/api/projects/" + encodeURIComponent(project.id) + "/export", { method: "POST" });
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
}

async function deleteProject(project) {
  var go = window.confirm("프로젝트와 모든 장면·어노테이션이 삭제됩니다. 되돌릴 수 없습니다.");
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
  var isProxy = project.mockupSource && project.mockupSource.type === "proxy";
  title.appendChild(el("span", "c-badge", isProxy ? "URL 프록시" : "ZIP 업로드"));
  head.appendChild(title);
  var metaText = "장면 " + project.scenes.length + " · 어노테이션 " + project.annotations.length +
    " · " + formatDate(project.updatedAt) + " 수정";
  if (isProxy) metaText += " · " + project.mockupSource.originUrl;
  head.appendChild(el("span", "c-project-meta", metaText));
  card.appendChild(head);

  var actions = el("div", "c-project-actions");
  var openLink = el("a", "c-btn c-btn-ghost", "편집 열기");
  openLink.href = mockupHref(project.id);
  openLink.target = "_blank";
  openLink.rel = "noopener";
  actions.appendChild(openLink);

  var exportBtn = el("button", "c-btn c-btn-ghost", "내보내기");
  exportBtn.type = "button";
  exportBtn.addEventListener("click", function () { void exportProject(project, listStatusEl); });
  actions.appendChild(exportBtn);

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
      listEl.appendChild(el("div", "c-empty", "아직 프로젝트가 없습니다. 위에서 빌드 zip을 업로드해 시작하세요."));
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
    body: JSON.stringify({ name: name, originUrl: originUrl })
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
      </div>

      <div class="c-tabpanel" role="tabpanel" aria-hidden="false">
        <form id="upload-form">
          <div class="c-row">
            <label for="project-name">프로젝트 이름</label>
            <input id="project-name" type="text" name="name" placeholder="예: 주문 개편 목업">
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
    </section>

    <section class="c-card">
      <h2>프로젝트 목록</h2>
      <div id="project-list" class="c-list"></div>
      <p id="list-status" class="c-status"></p>
    </section>
  </div>
  <script>${CONSOLE_JS}</script>
</body>
</html>`;

/** 루트 도메인 `/`의 콘솔 응답. */
export function consolePage(_req: Request, res: Response): void {
  res.status(200).type("text/html; charset=utf-8").send(CONSOLE_HTML);
}
