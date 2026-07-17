import type { Request, Response } from "express";
import { WORKING_NAME } from "@mockspec/shared";
import { SHELL_CSS, THEME_INIT_JS, THEME_TOGGLE_JS, pageHeader } from "./shell.js";

/**
 * 정적 안내 페이지 — 사용 가이드(/guide)·FAQ(/faq).
 *
 * 콘솔과 같은 방식의 서버 서빙 정적 HTML 1장 (프레임워크 금지, 외부 참조 0건).
 * 내용의 원본은 docs/user-guide.md — 문서가 바뀌면 이 페이지도 동기화한다.
 * 명칭은 콘솔 탭과 동일한 표면 용어(ZIP 업로드·URL 등록·내 화면에서 편집)를 쓴다.
 */

const DOC_CSS = `
.g-shell { max-width: 860px; margin: 0 auto; padding: 44px 32px 96px; }
.g-hero { margin-bottom: 36px; }
.g-hero h1 { margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: var(--c-text); }
.g-hero p { margin: 0; font-size: 12.5px; color: var(--c-muted); max-width: 560px; }
.g-hero a { color: var(--c-accent); text-decoration: none; font-weight: 500; }
.g-hero a:hover { text-decoration: underline; }

.g-section { margin-bottom: 44px; }
.g-section > h2 { margin: 0 0 4px; font-size: 15px; font-weight: 700; letter-spacing: -0.2px; color: var(--c-text); }
.g-section > .g-section-desc { margin: 0 0 16px; font-size: 12px; color: var(--c-muted); }
.g-section h3 { margin: 26px 0 10px; font-size: 12.5px; font-weight: 700; color: var(--c-text); }
.g-section p, .g-section li { font-size: 12px; color: var(--c-text-3); line-height: 1.7; }
.g-section p { margin: 0 0 10px; }
.g-note { margin: 10px 0 0; padding: 10px 14px; border-left: 2px solid var(--c-border-2); background: var(--c-surface-2); border-radius: 0 6px 6px 0; font-size: 11.5px; color: var(--c-muted); }
code {
  padding: 1px 5px; background: var(--c-chip); border: 1px solid var(--c-border); border-radius: 4px;
  font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: var(--c-text-2);
}
.g-section a { color: var(--c-accent); text-decoration: none; font-weight: 500; }
.g-section a:hover { text-decoration: underline; }

.g-paths { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin-bottom: 16px; }
.g-path {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px;
  box-shadow: var(--c-shadow); padding: 18px 20px; display: flex; flex-direction: column; gap: 6px;
}
.g-path-head { display: flex; align-items: center; gap: 8px; }
.g-path-head h3 { margin: 0; font-size: 12.5px; font-weight: 700; color: var(--c-text); }
.g-badge { padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 600; background: var(--c-chip); color: var(--c-text-3); border: 1px solid var(--c-border); }
.g-badge.is-primary { background: var(--c-accent-ring); color: var(--c-accent); border-color: transparent; }
.g-path p { margin: 0; font-size: 11.5px; color: var(--c-muted); line-height: 1.6; }
.g-path dl { margin: 8px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 11px; }
.g-path dt { color: var(--c-faint); }
.g-path dd { margin: 0; color: var(--c-text-3); }

.g-table-wrap { overflow-x: auto; }
table.g-table { border-collapse: collapse; width: 100%; font-size: 11.5px; background: var(--c-surface); }
.g-table th, .g-table td { border: 1px solid var(--c-border); padding: 7px 12px; text-align: left; color: var(--c-text-3); vertical-align: top; }
.g-table thead th { background: var(--c-surface-2); color: var(--c-text-2); font-weight: 600; }
.g-table tbody th { background: var(--c-surface-2); color: var(--c-text-3); font-weight: 500; white-space: nowrap; }

ol.g-steps { list-style: none; margin: 0 0 8px; padding: 0; counter-reset: step; }
ol.g-steps > li {
  counter-increment: step; position: relative; padding: 0 0 14px 34px; margin: 0;
}
ol.g-steps > li::before {
  content: counter(step); position: absolute; left: 0; top: 1px;
  width: 20px; height: 20px; border-radius: 999px; background: var(--c-chip); color: var(--c-text-3);
  font-size: 10.5px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}
ol.g-steps > li:not(:last-child)::after {
  content: ""; position: absolute; left: 9.5px; top: 25px; bottom: 3px; width: 1px; background: var(--c-border);
}
ul.g-list { margin: 0 0 10px; padding-left: 18px; }
ul.g-list li { margin-bottom: 5px; }

.g-faq-group { margin-bottom: 32px; }
.g-faq-group > h2 { margin: 0 0 10px 2px; font-size: 13px; font-weight: 700; color: var(--c-text); }
.g-faq-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 10px; box-shadow: var(--c-shadow); padding: 4px 20px; }
.g-faq-item { border-bottom: 1px solid var(--c-chip); }
.g-faq-item:last-child { border-bottom: none; }
.g-faq-item summary {
  cursor: pointer; padding: 14px 2px; font-size: 12.5px; font-weight: 600; color: var(--c-text);
  list-style: none; display: flex; gap: 10px; align-items: baseline;
}
.g-faq-item summary::-webkit-details-marker { display: none; }
.g-faq-item summary::before { content: "＋"; color: var(--c-faint); font-weight: 400; flex: 0 0 auto; }
.g-faq-item[open] summary::before { content: "－"; }
.g-faq-item summary:hover { color: var(--c-accent); }
.g-faq-a { padding: 0 2px 16px 24px; }
.g-faq-a p { margin: 0 0 8px; font-size: 12px; color: var(--c-text-3); line-height: 1.7; }
.g-faq-a p:last-child { margin-bottom: 0; }
.g-faq-a a { color: var(--c-accent); text-decoration: none; font-weight: 500; }
.g-faq-a a:hover { text-decoration: underline; }

.g-foot { margin-top: 8px; padding-top: 20px; border-top: 1px solid var(--c-border); font-size: 11.5px; color: var(--c-muted); }
.g-foot a { color: var(--c-accent); text-decoration: none; font-weight: 500; }
.g-foot a:hover { text-decoration: underline; }
`.trim();

function docPage(title: string, active: "guide" | "faq", body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — ${WORKING_NAME}</title>
  <script>${THEME_INIT_JS}</script>
  <style>${SHELL_CSS}\n${DOC_CSS}</style>
</head>
<body>
  ${pageHeader(active)}
  <main class="g-shell">
${body}
  </main>
  <script>${THEME_TOGGLE_JS}</script>
</body>
</html>`;
}

const GUIDE_BODY = `
    <div class="g-hero">
      <h1>사용 가이드</h1>
      <p>목업을 등록하고, 화면 위에 설명을 달고, 파일 하나로 열리는 기획서 HTML로 내보내는 과정을 안내합니다.</p>
    </div>

    <section class="g-section">
      <h2>연결 방식 고르기</h2>
      <p class="g-section-desc">목업이 어디에 있는지에 따라 세 가지 방식 중 하나를 선택합니다. 등록 이후의 편집·마스킹·내보내기는 모두 동일합니다.</p>
      <div class="g-paths">
        <div class="g-path">
          <div class="g-path-head"><h3>ZIP 업로드</h3><span class="g-badge is-primary">권장</span></div>
          <p>빌드 결과물을 압축해 올립니다. 준비가 가장 간단합니다.</p>
          <dl>
            <dt>준비물</dt><dd>빌드 산출물 zip</dd>
            <dt>적합</dt><dd>목업 저장소가 있고 빌드할 수 있을 때</dd>
          </dl>
        </div>
        <div class="g-path">
          <div class="g-path-head"><h3>URL 등록</h3></div>
          <p>이미 배포된 주소를 그대로 연결합니다. zip을 만들 필요가 없습니다.</p>
          <dl>
            <dt>준비물</dt><dd>서버가 접근 가능한 URL</dd>
            <dt>적합</dt><dd>스테이징·데모가 이미 떠 있을 때</dd>
          </dl>
        </div>
        <div class="g-path">
          <div class="g-path-head"><h3>내 화면에서 편집</h3><span class="g-badge">확장</span></div>
          <p>브라우저 확장이 지금 보고 있는 화면 위에 편집기를 띄웁니다.</p>
          <dl>
            <dt>준비물</dt><dd>Chrome 확장 + 연결 코드</dd>
            <dt>적합</dt><dd>로그인 뒤 화면, 사내 시스템, 로컬 개발 서버</dd>
          </dl>
        </div>
      </div>
      <div class="g-table-wrap">
        <table class="g-table">
          <thead><tr><th></th><th>ZIP 업로드</th><th>URL 등록</th><th>내 화면에서 편집</th></tr></thead>
          <tbody>
            <tr><th>로그인이 필요한 화면</th><td>— (정적이라 무관)</td><td>불가 (익명 접근만)</td><td>가능 (내 세션 그대로)</td></tr>
            <tr><th>원본 반영</th><td>업로드 시점에 고정</td><td>원본 서버 실시간</td><td>내 브라우저 화면 실시간</td></tr>
            <tr><th>저장 인증</th><td>없음</td><td>없음</td><td>프로젝트 토큰</td></tr>
          </tbody>
        </table>
      </div>
      <p class="g-note">망설여진다면 — zip을 만들 수 있으면 ZIP 업로드, 로그인 없이 URL로 열리면 URL 등록, 그 외에는 내 화면에서 편집을 선택하세요.</p>
    </section>

    <section class="g-section">
      <h2>시작하기</h2>

      <h3>ZIP 업로드</h3>
      <ol class="g-steps">
        <li>목업 프로젝트를 빌드하고 결과물 폴더만 압축합니다. 예: <code>npm run build</code> → <code>zip -r mockup.zip dist</code></li>
        <li>콘솔의 <b>ZIP 업로드</b> 탭에서 이름을 입력하고 zip을 선택해 업로드합니다.</li>
        <li>완료 안내의 <b>편집 열기</b>를 누르면 편집기가 주입된 목업이 새 탭에서 열립니다.</li>
      </ol>
      <p class="g-note">zip은 200MB 이하, 루트(또는 한 겹 폴더 안)에 <code>index.html</code>이 있어야 합니다. 업로드 시점으로 고정되므로 목업이 바뀌면 새 프로젝트로 다시 올립니다.</p>

      <h3>URL 등록</h3>
      <ol class="g-steps">
        <li>서버 운영자가 허용 도메인 목록에 해당 오리진을 등록합니다. (최초 1회)</li>
        <li>콘솔의 <b>URL 등록</b> 탭에서 이름과 목업 URL을 입력해 등록합니다.</li>
        <li><b>편집 열기</b>를 누르면 프록시를 거친 목업이 편집기와 함께 열립니다.</li>
      </ol>
      <p class="g-note">원본은 익명으로 가져옵니다 — 로그인이나 SSO가 필요한 화면은 열리지 않으며, 그 경우 <b>내 화면에서 편집</b>을 사용합니다.</p>

      <h3>내 화면에서 편집 (확장)</h3>
      <ol class="g-steps">
        <li>Chrome에서 <code>chrome://extensions</code> → 개발자 모드 → <b>압축해제된 확장 프로그램을 로드</b>로 확장을 설치합니다. (최초 1회)</li>
        <li>콘솔의 <b>내 화면에서 편집 (확장)</b> 탭에서 프로젝트를 만들고, 표시되는 <b>연결 코드</b>를 복사합니다.</li>
        <li>대상 페이지 탭에서 확장 팝업을 열어 연결 코드를 붙여넣고 <b>연결</b>을 누릅니다.</li>
        <li>페이지를 새로고침해 우하단에 편집 버튼(✎)이 보이면 연결된 것입니다.</li>
      </ol>
      <p class="g-note">연결 코드에는 저장 권한 토큰이 포함됩니다 — 코드를 공유하면 쓰기 권한도 공유됩니다. 분실·유출 시 프로젝트 카드의 <b>토큰 재발급</b>을 사용하세요.</p>
    </section>

    <section class="g-section">
      <h2>편집</h2>
      <p class="g-section-desc">편집 화면의 기능은 연결 방식과 무관하게 동일합니다.</p>
      <ul class="g-list">
        <li><b>화면 등록</b> — 목업을 원하는 상태로 만든 뒤 <b>+ 현재 화면 등록</b>을 누릅니다. 목록에서 제목을 바로 입력할 수 있습니다.</li>
        <li><b>앱 화면 전환</b> — SPA 주소가 바뀌면 <b>새 화면으로 등록할까요?</b> 배너가 나타납니다. URL이 그대로인 탭·MDI 화면은 패널에서 기존 화면을 직접 선택하거나 새로 등록합니다.</li>
        <li><b>어노테이션</b> — 편집 모드(Alt+Shift+E)에서 요소를 클릭해 설명을 답니다. 마커는 드래그로 위치를 조정합니다.</li>
        <li><b>화면 이동</b> — 어노테이션에 이동할 화면과 조건을 지정하면 산출물에 흐름도로 그려집니다.</li>
        <li><b>저장</b> — 자동 저장됩니다. 패널 상단의 <code>저장됨 ✓</code>로 확인하세요.</li>
      </ul>
    </section>

    <section class="g-section">
      <h2>마스킹</h2>
      <p class="g-section-desc">스냅샷에는 화면의 실데이터가 그대로 담깁니다. 외부 공유 전에 치환 규칙을 적용하세요.</p>
      <ol class="g-steps">
        <li>프로젝트 카드의 <b>마스킹 편집</b>에서 규칙을 추가합니다. (찾을 문자열 → 치환할 문자열)</li>
        <li><b>전체 화면에 적용</b>을 누르면 마스킹본이 생성됩니다. 원본 스냅샷은 보존됩니다.</li>
        <li>내보내기 시 마스킹본이 우선 사용됩니다.</li>
      </ol>
    </section>

    <section class="g-section">
      <h2>내보내기와 산출물</h2>
      <ul class="g-list">
        <li>산출물은 <b>단독 HTML 1개 파일</b>입니다. 네트워크 없이 <code>file://</code>로 열리므로 파일만 전달하면 됩니다.</li>
        <li>화면 이동이 지정돼 있으면 상단에 <b>프로세스 흐름도</b>가 그려집니다. 노드를 누르면 해당 화면으로 이동합니다.</li>
        <li>좌측 화면 목록, 중앙 스냅샷과 마커, 우측 어노테이션의 3단 구성이며 각 영역이 따로 스크롤됩니다.</li>
      </ul>
      <p class="g-foot">더 자세한 동작 원리와 문제 해결은 <a href="/faq">FAQ</a> 또는 저장소의 <code>docs/user-guide.md</code>를 참고하세요.</p>
    </section>
`.trimEnd();

function faqItem(q: string, a: string): string {
  return `        <details class="g-faq-item">
          <summary>${q}</summary>
          <div class="g-faq-a">${a}</div>
        </details>`;
}

function faqGroup(title: string, items: string[]): string {
  return `    <section class="g-faq-group">
      <h2>${title}</h2>
      <div class="g-faq-card">
${items.join("\n")}
      </div>
    </section>`;
}

const FAQ_BODY = `
    <div class="g-hero">
      <h1>자주 묻는 질문</h1>
      <p>사용 순서 전반은 <a href="/guide">사용 가이드</a>에서 확인할 수 있습니다.</p>
    </div>

${faqGroup("시작하기", [
  faqItem(
    "어떤 등록 방식을 골라야 하나요?",
    `<p>zip을 만들 수 있으면 <b>ZIP 업로드</b>(가장 간단), 로그인 없이 URL로 열리면 <b>URL 등록</b>, 로그인 뒤 화면이거나 로컬에서만 도는 화면이면 <b>내 화면에서 편집</b>입니다.</p>
           <p>한 프로젝트는 한 방식에 묶입니다. 같은 목업을 다른 방식으로 쓰려면 프로젝트를 새로 만듭니다.</p>`
  ),
  faqItem(
    "zip 업로드가 거부됩니다.",
    `<p>압축 파일 기준 200MB 제한입니다. <code>node_modules</code>를 제외하고 빌드 결과물 폴더만 압축하세요. 루트(또는 한 겹 폴더 안)에 <code>index.html</code>이 있어야 합니다.</p>`
  ),
  faqItem(
    "URL 등록이 거부됩니다.",
    `<p>서버에 허용 도메인으로 등록된 오리진만 연결할 수 있습니다. 거부 사유는 등록 폼 아래에 표시되며, 도메인 추가는 서버 운영자에게 요청하세요.</p>`
  ),
  faqItem(
    "로그인해야 보이는 화면도 등록할 수 있나요?",
    `<p>네 — <b>내 화면에서 편집</b> 방식이 그 용도입니다. 서버가 화면을 가져오는 대신 확장이 지금 로그인된 내 화면 위에 편집기를 띄우므로, SSO·사내망·로컬 환경 모두 사용할 수 있습니다.</p>`
  ),
])}

${faqGroup("확장 연결", [
  faqItem(
    "연결 코드를 잃어버렸습니다.",
    `<p>프로젝트 카드의 <b>연결 코드 복사</b>(같은 브라우저 세션 동안 보관)를 먼저 시도하고, 없으면 <b>토큰 재발급</b>을 사용하세요.</p>
           <p>재발급하면 이전 토큰은 즉시 무효가 되므로, 확장 팝업에 새 코드로 다시 연결해야 합니다.</p>`
  ),
  faqItem(
    "연결했는데 편집 버튼(✎)이 보이지 않습니다.",
    `<p>확장 팝업에서 지금 보고 있는 <b>주소(오리진)</b>에 연결했는지 확인한 뒤 페이지를 새로고침하세요. 확장을 업데이트했다면 <code>chrome://extensions</code>에서 확장을 새로고침한 뒤 대상 페이지도 새로고침합니다.</p>`
  ),
  faqItem(
    "저장이 안 되고 ‘오프라인 — 로컬 보관 중’이 표시됩니다.",
    `<p>서버가 꺼져 있거나 토큰이 무효화된 경우입니다. 토큰을 재발급했다면 새 연결 코드로 다시 연결하세요. 서버가 복구되면 보관 중인 변경 사항은 자동으로 전송됩니다.</p>`
  ),
])}

${faqGroup("스냅샷과 산출물", [
  faqItem(
    "스냅샷의 글꼴이 원본과 다릅니다.",
    `<p>의도된 동작입니다. 스냅샷은 레이아웃과 구조 재현이 목적이라 웹폰트는 시스템 글꼴로 대체하고, 비디오·오디오는 영역만 남깁니다. 산출물 크기를 가볍게 유지하기 위한 정책입니다.</p>`
  ),
  faqItem(
    "목업을 수정했는데 반영되지 않습니다.",
    `<p>ZIP 업로드는 업로드 시점으로 고정됩니다 — 새 zip으로 프로젝트를 다시 만드세요. URL 등록은 원본을 실시간으로 반영합니다.</p>
           <p>이미 등록한 화면은 캡처본이므로, 바뀐 상태를 다시 만들고 화면 행의 ⟳(다시 캡처)를 누르면 교체됩니다.</p>`
  ),
  faqItem(
    "마스킹에 정규식을 쓸 수 있나요?",
    `<p>지원하지 않습니다. 반복 등장하는 실데이터 문자열을 그대로 규칙에 넣으면 전체 화면에 부분 일치로 치환됩니다. 원본 스냅샷은 보존되므로 규칙을 고치면 원본에서 다시 생성됩니다.</p>`
  ),
  faqItem(
    "산출물 HTML을 받은 사람에게도 서버가 필요한가요?",
    `<p>아니요. 산출물은 단독 HTML 1개 파일로, 네트워크 요청 없이 <code>file://</code>로 열립니다. 파일만 전달하면 됩니다.</p>`
  ),
])}
`.trimEnd();

const GUIDE_HTML = docPage("사용 가이드", "guide", GUIDE_BODY);
const FAQ_HTML = docPage("FAQ", "faq", FAQ_BODY);

/** 루트 도메인 `/guide` 응답. */
export function guidePage(_req: Request, res: Response): void {
  res.status(200).type("text/html; charset=utf-8").send(GUIDE_HTML);
}

/** 루트 도메인 `/faq` 응답. */
export function faqPage(_req: Request, res: Response): void {
  res.status(200).type("text/html; charset=utf-8").send(FAQ_HTML);
}
