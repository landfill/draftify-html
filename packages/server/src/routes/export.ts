import fs from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import { themeTokenDeclarations, type SpecProject } from "@mockspec/shared";
import { readAsset, readSpec } from "../store/projectStore.js";
import { appendExportRecord } from "../store/exportStore.js";
import { sendError } from "../errors.js";

const EXPORT_SIZE_WARNING_BYTES = 50 * 1024 * 1024;

/*
  산출물의 시각 언어 (T87-14 / s1-kickoff 11절 20차 / 상세는 ui-standard 6.8절).

  이 CSS는 산출물 **하나하나에 통째로 실려 나간다** — 설명은 짧게 두고 근거는 문서에 둔다.

  색은 전부 THEME_TOKENS에서 온다. 값이 빌드타임에 이 문자열로 구워질 뿐이라 결과 HTML의
  네트워크 요청은 0건 그대로다(제1원칙 4). 손으로 리터럴을 적지 않는다 — 남은 예외는
  경고색(팔레트에 warn 토큰이 없다)과 의도적인 흰색(임의 색 위에서의 분리)뿐이고 각각 자리에 적었다.
  라이트 고정이다: 목업 캡처가 캡처 시점 색으로 굳어 있어 셸만 뒤집으면 문서 안에서 두 테마가 부딪힌다.
*/
const VIEWER_CSS = `
:root {
${themeTokenDeclarations("light")}
  color-scheme: light;
  /* 두 콘솔과 같은 스택. 이름만 얹으므로 @font-face·링크가 없다 — 요청은 0건 그대로다 */
  font-family: Pretendard, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  /* 편집 모드 패널(13px)과 같은 밀도 — 미지정 시 브라우저 기본 16px이 상속돼 과대해진다 (#9).
     81.25% = 기본 16px 기준 13px. 절대값 대신 백분율로 사용자 브라우저 글꼴 설정을 존중 (리뷰 반영) */
  font-size: 81.25%;
  color: var(--c-text);
  background: var(--c-bg);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--c-bg); }
button, input, textarea { font: inherit; }
/* 포커스 (ui-standard 4.6절 F-03) — 두 콘솔·SDK와 같은 2px 링 + 2px offset.
   [tabindex]가 필요한 이유: 어노테이션 카드는 button이 아니라 tabIndex를 준 article이다 */
a:focus-visible, button:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--c-accent-focus);
  outline-offset: 2px;
}
/* 헤더·(선택)흐름도·본문 3단 — 흐름도 섹션이 없어도 본문이 남은 높이를 채우도록 flex.
   셸을 뷰포트 높이에 고정해 페이지 세로 스크롤을 없앤다 — 타이틀과 디스크립션은 항상
   보이고, 세로 스크롤은 2컬럼 각자 내부에서 일어난다 (킥오프 19차 이후 화면영역은 fit
   축소로 캡처 전체를 담으므로 통상 스크롤이 생기지 않는다) */
.ms-shell { height: 100vh; display: flex; flex-direction: column; }
.ms-layout { flex: 1; }
/* 문서 헤더 밴드 — 첫 화면에서 "기획서 문서"임이 드러나도록 본문과 대비 (#10).
   그라디언트였으나 제품 전체에서 유일한 그라디언트라 단색으로 접었다 (M-08, 20차 ③) */
.ms-header {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; background: var(--c-btn-bg);
  border-bottom: 1px solid var(--c-btn-bg-hover); color: #fff;
}
.ms-title { margin: 0; font-size: 18px; line-height: 1.3; font-weight: 700; }
.ms-meta { color: var(--c-muted); font-size: 13px; white-space: nowrap; }
/* .ms-meta는 중앙 스테이지(route)에서도 쓰인다 — 밝은 색은 헤더 안으로 한정.
   흰색 — 채움 배경(--c-btn-bg) 위에서 6.29:1로 AA 충족 (ui-standard 6.5절의 계산과 같다) */
.ms-header .ms-meta { color: #fff; }
/* 화면영역 + 디스크립션 2컬럼 (s1-kickoff 11절 19차, 이슈 #86) — 좌측 화면목록은 없앴다.
   행을 minmax(0,1fr)로 고정 — auto 행은 콘텐츠 높이로 커져 셸을 넘치므로 내부 스크롤이 안 생긴다 */
.ms-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; grid-template-rows: minmax(0, 1fr); min-height: 0; }
.ms-panel { background: var(--c-surface); overflow: auto; min-width: 0; }
.ms-collapse-btn {
  border: 1px solid var(--c-border); background: var(--c-surface); border-radius: 4px; cursor: pointer;
  color: var(--c-muted); font-size: 14px; line-height: 1; padding: 4px 8px;
}
.ms-collapse-btn:hover { background: var(--c-chip); color: var(--c-text); }
.ms-panel { border-left: 1px solid var(--c-border); }
.ms-section-title { padding: 12px 14px 8px; font-size: 12px; font-weight: 700; color: var(--c-muted); text-transform: uppercase; letter-spacing: .04em; }
.ms-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--c-accent); font-size: 12px; font-weight: 700; }
.ms-scene-title { display: block; margin-top: 2px; overflow-wrap: anywhere; }
/* 화면영역은 [스크롤 영역][전/후 컨트롤] 세로 2단 — 컨트롤은 스크롤을 따라가지 않는다 */
.ms-main { min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.ms-main-body { flex: 1; min-height: 0; overflow: auto; padding: 16px; }
/* 화면 이동 컨트롤 (s1-kickoff 11절 19차) — 좌측 화면목록을 없앤 뒤의 주 이동 수단.
   흐름도는 전이가 없으면 렌더되지 않으므로 이 컨트롤은 흐름도 유무와 무관하게 항상 있다 */
.ms-scene-nav {
  flex: none; display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 6px 16px; background: var(--c-surface); border-top: 1px solid var(--c-border);
}
.ms-nav-btn {
  border: 1px solid var(--c-border); background: var(--c-surface); border-radius: 8px; cursor: pointer;
  color: var(--c-text); font-size: 13px; line-height: 1; padding: 8px 14px;
}
.ms-nav-btn:hover:not(:disabled) { background: var(--c-chip); }
/* 4.6절의 disabled 규칙. 종전의 흐린 회색은 --c-muted와 명도가 비슷해 "비활성"으로 읽히지
   않았다. disabled 속성이 있어 포커스 대상이 아니므로 opacity가 링을 흐릴 여지도 없다 (6.5절) */
.ms-nav-btn:disabled { opacity: .5; cursor: not-allowed; }
.ms-nav-position { color: var(--c-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
/* 축소 하한을 넘길 만큼 큰 캡처만 .ms-main-body가 양방향 스크롤한다 (통상은 fit로 담긴다) */
.ms-stage-header { display: flex; justify-content: space-between; gap: 12px; align-items: start; margin-bottom: 12px; }
.ms-page-band {
  margin-bottom: 12px; padding: 12px 14px; background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 8px;
}
.ms-page-band__section { font-size: 12px; font-weight: 600; color: var(--c-muted); margin-bottom: 4px; }
.ms-page-band__title { font-size: 15px; font-weight: 700; line-height: 1.4; color: var(--c-text); }
.ms-stage-title { margin: 0; font-size: 16px; line-height: 1.4; }
.ms-note { margin: 6px 0 0; color: var(--c-muted); font-size: 13px; }
.ms-stage-wrap {
  position: relative; background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 8px; overflow: hidden; width: max-content; max-width: none;
  /* fit 축소 후 남는 가로 여백은 양옆으로 나눈다 — 한쪽에 몰리면 빈 공간이 결함처럼 보인다 */
  margin-inline: auto;
}
/* fit 축소 (킥오프 19차): iframe과 마커 레이어를 한 덩어리로 줄여 좌표계가 어긋나지 않게 한다.
   transform은 레이아웃 상자를 줄이지 않으므로 축소 후 크기는 JS가 .ms-stage-wrap에 지정한다 */
.ms-stage-scale { position: relative; transform-origin: top left; }
.ms-frame { display: block; width: 100%; min-height: 480px; border: 0; background: var(--c-surface); }
.ms-marker-layer { position: absolute; inset: 0; pointer-events: none; }
.ms-marker {
  position: absolute; width: 28px; height: 28px; transform: translate(-50%, -50%);
  display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
  /* 흰 테두리·흰 글자는 임의 색의 캡처 위에서 배경과 분리하려는 의도적 흰색이라 토큰화 대상이
     아니다. 그림자 rgba도 남긴다 — 그림자 토큰화는 M-05의 일이고 네 표면을 함께 봐야 한다 */
  border: 2px solid #fff; background: var(--c-btn-bg); color: #fff; font-weight: 700; font-size: 13px;
  box-shadow: 0 2px 8px rgba(32, 33, 36, .28); cursor: pointer; pointer-events: auto;
}
/*
  마커의 포커스는 outline이 아니라 box-shadow로 전달한다 (20차 ⑤): outline 슬롯을 아래
  .is-active(앰버)가 이미 쓰고 있어, 같은 슬롯을 다투면 활성·포커스 중 하나가 사라진다.
  흰 띠는 임의 색의 캡처 위에서 링을 분리한다 (SDK .fab·.marker와 같은 처리, 6.5절).
  ⚠️ .is-active를 이 규칙보다 **뒤에** 둔다 — 특정도가 같아 순서가 승부를 가른다.
*/
.ms-marker:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--c-accent-focus), 0 0 0 6px rgba(255,255,255,.92), 0 2px 8px rgba(32, 33, 36, .28);
}
/* 앰버는 팔레트에 warn 토큰이 없어 리터럴로 남긴다 (4.1절이 지적한 공백) */
.ms-marker.is-active { outline: 3px solid #fbbc04; outline-offset: 2px; }
.ms-marker.is-uncertain { border-style: dashed; background: var(--c-muted); }
.ms-empty {
  min-height: 480px; display: grid; place-items: center; padding: 24px; text-align: center;
  color: var(--c-muted); background: var(--c-surface); border: 1px dashed var(--c-border-2); border-radius: 8px;
}
.ms-list { display: grid; gap: 10px; padding: 0 12px 14px; }
.ms-annotation {
  border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-surface); padding: 12px; text-align: left; cursor: pointer;
}
.ms-annotation:hover { border-color: var(--c-border-hover); }
.ms-annotation.is-active { border-color: var(--c-accent); box-shadow: 0 0 0 2px var(--c-accent-ring) inset; }
.ms-annotation-head { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
.ms-number {
  width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; background: var(--c-btn-bg); color: #fff; font-weight: 700; font-size: 12px; flex: 0 0 auto;
}
.ms-annotation-title { font-weight: 700; font-size: 12px; overflow-wrap: anywhere; }
.ms-description { color: var(--c-text-2); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.ms-description p { margin: 0 0 8px; }
.ms-description p:last-child { margin-bottom: 0; }
.ms-policy { display: inline-block; margin: 8px 6px 0 0; padding: 3px 6px; border-radius: 4px; background: var(--c-chip); color: var(--c-text-2); font-size: 12px; }
/* 강조 틴트 칩 — 제품에 이미 있는 조합 그대로다 (SDK .btn, 콘솔 .g-badge.is-primary) */
.ms-transition {
  display: block; margin-top: 8px; padding: 5px 8px; border: 1px solid var(--c-accent); border-radius: 4px;
  background: var(--c-accent-ring); color: var(--c-accent); font-size: 12px; font-weight: 600; text-align: left;
  cursor: pointer; width: 100%; overflow-wrap: anywhere;
}
/* hover는 같은 강조색을 채운다 — 색상 이동 없이 한 단계 강해진다 (4.6절) */
.ms-transition:hover { background: var(--c-btn-bg); color: #fff; }
/* 프로세스 흐름도 (output-standard §2 섹션 2) — 넓은 그래프는 섹션 안에서만 가로 스크롤 */
.ms-flow { background: var(--c-surface); border-bottom: 1px solid var(--c-border); }
.ms-flow-head { display: flex; align-items: center; justify-content: space-between; padding-right: 12px; }
.ms-flow-head .ms-section-title { padding-bottom: 8px; }
/* 큰 그래프가 본문(2컬럼)을 밀어내지 않도록 높이를 제한하고 섹션 안에서만 스크롤 */
.ms-flow-body { overflow: auto; max-height: 40vh; padding: 0 14px 14px; }
.ms-flow-body svg { display: block; }
.ms-flow-edge { fill: none; stroke: var(--c-muted); stroke-width: 1.5; }
/* 화살촉은 marker 안의 path다 — 간선과 같은 토큰을 써야 둘이 갈리지 않는다 */
.ms-flow-arrow { fill: var(--c-muted); }
/* stroke: #fff는 배경색이 아니라 글자 뒤 헤일로다 — 간선에 겹쳐도 읽히게 한다 */
.ms-flow-label { font: 600 11px/1 Pretendard, Inter, ui-sans-serif, system-ui, sans-serif; fill: var(--c-muted); paint-order: stroke; stroke: #fff; stroke-width: 3px; }
.ms-flow-node { cursor: pointer; }
/* 노드도 .ms-transition과 같은 강조 틴트 칩이다 */
.ms-flow-node rect { fill: var(--c-accent-ring); stroke: var(--c-accent); }
.ms-flow-node text { font: 600 12px/1 Pretendard, Inter, ui-sans-serif, system-ui, sans-serif; fill: var(--c-btn-bg-hover); }
.ms-flow-node:hover rect, .ms-flow-node.is-active rect { fill: var(--c-btn-bg); }
.ms-flow-node:hover text, .ms-flow-node.is-active text { fill: #fff; }
.ms-flow-node.is-active rect { stroke-width: 2; }
/* 경고색은 팔레트에 warn 토큰이 없어 리터럴로 남긴다 (4.1절) */
.ms-warning { color: #b06000; font-weight: 700; }
@media (max-width: 900px) {
  /* 1단 스택은 뷰포트에 2컬럼이 다 안 들어간다 — 페이지 스크롤로 되돌린다 */
  .ms-shell { height: auto; min-height: 100vh; }
  .ms-header { align-items: flex-start; flex-direction: column; }
  .ms-meta { white-space: normal; }
  .ms-layout { grid-template-columns: 1fr; grid-template-rows: auto auto; }
  .ms-panel { border: 0; border-top: 1px solid var(--c-border); }
  .ms-main { order: 1; }
  .ms-panel { order: 2; }
  /* 페이지 스크롤로 돌아가므로 화면영역 내부 스크롤을 풀어 캡처가 잘리지 않게 한다 */
  .ms-main-body { overflow: visible; }
}
`.trim();

export interface SnapshotBundle {
  sceneId: string;
  assetKey: string;
  base64: string;
  byteLength: number;
}

export interface ExportHtmlInput {
  project: SpecProject;
  snapshots: SnapshotBundle[];
  viewerScript: string;
  generatedAt?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function escapeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function stripSourceMapComment(script: string): string {
  return script.replace(/\/\/# sourceMappingURL=.*$/gm, "").trim();
}

function downloadFilename(projectName: string): string {
  const base = projectName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "mockspec-export";
  return `${base}.html`;
}

function asciiHeaderFilename(filename: string): string {
  const ascii = filename
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/["\\]/g, "-")
    .replace(/-+/g, "-");
  return ascii === ".html" || !ascii.trim() ? "mockspec-export.html" : ascii;
}

/**
 * 산출물에 삽입할 뷰어 런타임. packages/viewer/dist/main.js **단일 파일만** 인라인한다.
 * main.js가 @mockspec/shared 등 외부 import를 하면 file:// 산출물에서 모듈 해석이 실패한다(제1원칙 4).
 * 장면 표시 헬퍼는 shared/sceneDisplay.ts와 main.ts에 의도적 복제 — 동등성은 viewer parity 테스트로 검증.
 */
export async function readViewerScript(): Promise<string> {
  if (process.env.MOCKSPEC_VIEWER_SCRIPT) return process.env.MOCKSPEC_VIEWER_SCRIPT;
  const viewerDistUrl = new URL("../../../viewer/dist/main.js", import.meta.url);
  return stripSourceMapComment(await fs.readFile(viewerDistUrl, "utf8"));
}

export function buildExportHtml({ project, snapshots, viewerScript, generatedAt }: ExportHtmlInput): string {
  const generated = generatedAt ?? new Date().toISOString();
  const snapshotTags = snapshots
    .map((snapshot) =>
      `<script type="text/plain" data-snapshot="${escapeAttribute(snapshot.sceneId)}" data-asset="${escapeAttribute(snapshot.assetKey)}">${snapshot.base64}</script>`,
    )
    .join("\n  ");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="mockspec">
  <meta name="mockspec-generated-at" content="${escapeAttribute(generated)}">
  <title>${escapeHtml(project.name)} 기획서</title>
  <style>${VIEWER_CSS}</style>
</head>
<body>
  <script type="application/json" id="spec-data">${escapeJsonForScript(project)}</script>
  ${snapshotTags}
  <div id="app"></div>
  <script type="module">
${stripSourceMapComment(viewerScript)}
  </script>
</body>
</html>`;
}

export async function exportProjectHtml(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const project = await readSpec(req.params.id);
    if (!project) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);

    const snapshots: SnapshotBundle[] = [];
    let usedMasked = false;
    for (const scene of project.scenes) {
      const assetKey = scene.maskedSnapshotAsset || scene.snapshotAsset;
      if (!assetKey) continue;
      const data = await readAsset(project.id, assetKey);
      if (!data) continue;
      if (assetKey === scene.maskedSnapshotAsset) usedMasked = true;
      snapshots.push({
        sceneId: scene.id,
        assetKey: assetKey,
        base64: data.toString("base64"),
        byteLength: data.byteLength,
      });
    }

    const html = buildExportHtml({
      project,
      snapshots,
      viewerScript: await readViewerScript(),
    });

    // [T29] 산출물 이력 — 메타만 기록, best-effort (이력 실패가 export를 막지 않는다. §6.3)
    await appendExportRecord(project.id, {
      specUpdatedAt: project.updatedAt,
      bytes: Buffer.byteLength(html, "utf8"),
      masked: usedMasked,
    }).catch(() => undefined);

    if (Buffer.byteLength(html, "utf8") > EXPORT_SIZE_WARNING_BYTES) {
      res.set("X-Mockspec-Warning", "EXPORT_TOO_LARGE");
    }

    const filename = downloadFilename(project.name);
    res
      .status(200)
      .type("text/html; charset=utf-8")
      .set("Content-Disposition", `attachment; filename="${asciiHeaderFilename(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
      .send(html);
  } catch (err) {
    next(err);
  }
}
