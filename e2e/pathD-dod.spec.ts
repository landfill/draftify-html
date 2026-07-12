import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { test, expect, chromium, type BrowserContext, type APIRequestContext } from "@playwright/test";

/**
 * 경로 D (S2.5) Definition of Done 시나리오 (guide/pathD-kickoff-spec.md §7).
 *
 * 1. 로그인 fixture(폼 + 쿠키로 게이트된 보호 화면)를 로컬 HTTP 서버로 기동
 * 2. 확장을 unpacked 로드하고 팝업 storage로 오리진↔프로젝트(토큰) 바인딩
 * 3. 사용자가 직접 로그인(서버가 대신 하지 않음) → 보호 화면 진입 → 확장이 SDK 주입
 * 4. 장면 등록·어노테이션·설명 → 동결·저장(토큰 인증, background 릴레이)
 * 5. 콘솔에서 마스킹 규칙 적용 → export
 * 6. 새 컨텍스트 file:// 오픈 → 마커 위치(≤2px)·설명 일치·마스킹 원문 0회·네트워크 0건
 * 7. 보안 회귀: 토큰 없는 저장 요청 401
 *
 * 확장은 persistent context + --load-extension으로만 로드되므로(신 headless) 이 spec은
 * 기본 test 픽스처의 browser 대신 자체 컨텍스트를 만든다.
 */

// chrome은 확장 페이지 컨텍스트(popup.evaluate) 안에서만 존재한다 — spec 타입 최소 선언
declare const chrome: { storage: { local: { set(items: Record<string, unknown>): Promise<void> } } };

const EXT_DIST = path.resolve("packages/extension/dist");
const REAL_NAME = "홍길동"; // 보호 화면의 실데이터 — 마스킹 대상
const MASKED = "고객";

// ── 로그인 fixture: /(로그인) · POST /login(쿠키) · /protected(쿠키 게이트) ──────────
const LOGIN_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>로그인</title></head>
<body><h1>사내 어드민 로그인</h1>
<form id="login-form">
  <input id="user" value="admin"><input id="pass" type="password" value="pw">
  <button id="login" type="submit">로그인</button>
</form>
<script>
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const res = await fetch("/login", { method: "POST" });
  if (res.ok) location.href = "/protected";
});
</script></body></html>`;

const PROTECTED_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>주문 어드민</title></head>
<body>
  <header><h1 id="page-title">주문 어드민</h1></header>
  <p id="greeting">${REAL_NAME}님 환영합니다</p>
  <main>
    <button id="action-pay">결제 승인</button>
    <button id="action-refund">환불 처리</button>
  </main>
  <footer><button id="logout">로그아웃</button></footer>
</body></html>`;

function startLoginFixture(): Promise<{ server: http.Server; origin: string }> {
  const server = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/login" && req.method === "POST") {
      // host-only 쿠키 — 이 응답을 받아야만 보호 화면에 들어갈 수 있다 (로그인 증명)
      res.writeHead(200, { "Set-Cookie": "sid=ok; Path=/", "Content-Type": "application/json" }).end("{}");
      return;
    }
    if (url === "/protected") {
      const cookie = req.headers.cookie || "";
      if (!cookie.includes("sid=ok")) {
        res.writeHead(302, { Location: "/" }).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html" }).end(PROTECTED_HTML);
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html" }).end(LOGIN_HTML);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({ server, origin: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function registerSnippetProject(
  request: APIRequestContext
): Promise<{ projectId: string; token: string }> {
  const res = await request.post("/api/projects", { data: { name: "주문 어드민 (경로 D)", source: "snippet" } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { project: { id: string }; token: string };
  return { projectId: body.project.id, token: body.token };
}

let fixture: { server: http.Server; origin: string };
let context: BrowserContext;

test.beforeAll(async () => {
  fixture = await startLoginFixture();
});
test.afterAll(async () => {
  await context?.close();
  fixture?.server.close();
});

test("경로 D DoD: 로그인 뒤 보호 화면을 확장으로 편집 → 마스킹 → export → 오프라인 검증", async ({ request, baseURL }, testInfo) => {
  test.slow();
  const serverUrl = baseURL!;

  // ── 2. 스냅샷(snippet) 프로젝트 등록 + 토큰 ─────────────────────────────
  const { projectId, token } = await registerSnippetProject(request);

  // ── 7(선). 보안 회귀: 토큰 없는 저장은 401 ───────────────────────────
  const noAuth = await request.put(`/api/projects/${projectId}`, {
    data: { version: 1, id: projectId },
  });
  expect(noAuth.status()).toBe(401);

  // ── 2. 확장 unpacked 로드 (신 headless) + 오리진 바인딩 ───────────────
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT_DIST}`, `--load-extension=${EXT_DIST}`],
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  const extId = new URL(sw.url()).host;

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.evaluate(
    async ({ origin, projectId, token, serverUrl }) => {
      await chrome.storage.local.set({ [`binding:${origin}`]: { projectId, token, serverUrl } });
    },
    { origin: fixture.origin, projectId, token, serverUrl }
  );
  await popup.close();

  // ── 3. 사용자가 직접 로그인 → 보호 화면 진입 ────────────────────────
  const page = await context.newPage();
  page.on("dialog", (d) => void d.accept());
  await page.goto(fixture.origin + "/");
  await page.locator("#login").click();
  await expect(page).toHaveURL(/\/protected$/);
  await expect(page.locator("#greeting")).toContainText(REAL_NAME); // 인증 뒤에만 보이는 실데이터

  // 확장이 SDK 주입 → 편집 진입
  await page.waitForSelector("[data-mockspec-root]", { state: "attached", timeout: 15_000 });
  await page.locator(".fab").click();
  await expect(page.locator(".panel")).toBeVisible();

  // 프로젝트 로드가 브리지(GET)로 성공했는지 — "불러오기 실패"가 아니어야 한다
  await expect(page.locator(".save")).not.toContainText("실패");

  // ── 4. 장면 등록 + 어노테이션 + 동결·저장(토큰 인증 릴레이) ───────────
  await page.getByRole("button", { name: "+ 현재 화면 등록" }).click();
  await expect(page.locator(".frz--ok")).toHaveCount(1, { timeout: 30_000 });

  const ANNS = [
    { target: "#action-pay", title: "결제 승인", desc: "권한 있는 담당자만 노출." },
    { target: "#logout", title: "로그아웃", desc: "세션 종료 후 로그인으로." },
  ] as const;
  for (const a of ANNS) {
    await page.locator(a.target).click();
    const title = page.locator("[data-ann-title]").last();
    await expect(title).toBeVisible();
    await title.fill(a.title);
    await page.locator(".ann__desc").last().fill(a.desc);
  }
  await expect(page.locator(".save")).toHaveText(/저장됨/, { timeout: 15_000 });

  // ── 5. 콘솔에서 마스킹 규칙 적용 (토큰은 sessionStorage 선주입 — prompt 회피) ──
  const console_ = await context.newPage();
  console_.on("dialog", (d) => void d.accept());
  await console_.addInitScript(
    ([id, tok]) => sessionStorage.setItem(`mockspec:tok:${id}`, tok),
    [projectId, token]
  );
  await console_.goto(serverUrl + "/");
  await console_.getByRole("button", { name: "마스킹 편집" }).first().click();
  await expect(console_.locator("#masking-modal")).toHaveClass(/is-open/);
  await console_.getByRole("button", { name: "+ 규칙 추가" }).click();
  await console_.locator(".c-mask-row input").nth(0).fill(REAL_NAME);
  await console_.locator(".c-mask-row input").nth(1).fill(MASKED);
  await console_.locator("#masking-apply").click();
  await expect(console_.locator("#masking-modal")).not.toHaveClass(/is-open/);

  // ── 5. export 다운로드 ───────────────────────────────────────────
  const downloadPromise = console_.waitForEvent("download");
  await console_.getByRole("button", { name: "내보내기" }).first().click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath("pathD-export.html");
  await download.saveAs(exportPath);
  expect((await fs.stat(exportPath)).size).toBeGreaterThan(5_000);

  // ── 6. 새 컨텍스트 file:// 오픈 + 검증 ───────────────────────────
  const offline = await context.browser()!.newContext();
  const viewer = await offline.newPage();
  const requests: string[] = [];
  viewer.on("request", (req) => requests.push(req.url()));
  await viewer.goto(`file://${exportPath}`);

  // 마스킹 원문 0회, 치환문 존재 (스냅샷 base64 디코드 검사)
  const html = await fs.readFile(exportPath, "utf-8");
  const snaps = [...html.matchAll(/data-snapshot="[^"]+"[^>]*>([^<]+)<\/script>/g)];
  expect(snaps.length).toBeGreaterThan(0);
  let maskedFound = false;
  for (const m of snaps) {
    const decoded = Buffer.from(m[1]!, "base64").toString("utf8");
    expect(decoded).not.toContain(REAL_NAME);
    if (decoded.includes(MASKED)) maskedFound = true;
  }
  expect(maskedFound, "치환 문자열이 산출물에 존재").toBe(true);

  // 마커 2개 · 설명 일치 · 위치 오차 ≤2px
  await expect(viewer.locator(".ms-marker")).toHaveCount(2);
  for (const [i, a] of ANNS.entries()) {
    const delta = await viewer.evaluate(
      ({ selector, num }) => {
        const iframe = document.querySelector<HTMLIFrameElement>(".ms-frame");
        const el = iframe?.contentDocument?.querySelector(selector);
        const marker = Array.from(document.querySelectorAll<HTMLElement>(".ms-marker")).find(
          (m) => m.textContent === num
        );
        if (!el || !marker) return null;
        const rect = el.getBoundingClientRect();
        return { dx: Math.abs(parseFloat(marker.style.left) - rect.right), dy: Math.abs(parseFloat(marker.style.top) - rect.top) };
      },
      { selector: a.target, num: String(i + 1) }
    );
    expect(delta, `${a.target} 마커 존재`).not.toBeNull();
    expect(delta!.dx).toBeLessThanOrEqual(2);
    expect(delta!.dy).toBeLessThanOrEqual(2);
    await expect(viewer.locator(".ms-annotation").nth(i)).toContainText(a.desc);
  }

  // 네트워크 0건: file:// 문서 1건 외 없음
  expect(requests.filter((u) => !u.startsWith("file://")), "외부 요청").toEqual([]);
  expect(requests, "file:// 문서 1건뿐").toHaveLength(1);

  await offline.close();

  // 이 프로젝트를 콘솔 목록에서 정리한다 — S1/S2 DoD는 단일 프로젝트 목록을 가정하므로
  // (spec 파일이 알파벳 순으로 이 spec 다음에 실행됨) 공유 서버에 잔재를 남기지 않는다.
  await request.delete(`/api/projects/${projectId}`);
});
