import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { test, expect, type Page } from "@playwright/test";

/**
 * S2 Definition of Done 시나리오 (guide/s2-kickoff-spec.md §8).
 *
 * 1. fixture 목업(Todo 앱)을 로컬 HTTP 서버로 기동 (URL 오리진 역할)
 * 2. 콘솔에서 URL 등록 (allowlist에 fixture 호스트만 든 전용 env) → 편집 화면 프록시 경유 열림 (SDK 주입 확인)
 * 3. 장면 2개 등록·어노테이션 부착·설명 입력 (S1과 동일 편집 플로우가 프록시 위에서 동작)
 * 4. 마스킹 규칙 1건 추가 → 전체 장면 적용
 * 5. export → 새 브라우저 컨텍스트에서 file:// 오픈
 * 6. 검증: 장면 전환·마커 위치(오차 ≤2px)·설명 일치, 마스킹 원문 문자열이 산출물에 0회, 네트워크 요청 0건
 * 7. 보안 회귀: 비허용 오리진·메타데이터 IP 등록이 400으로 거부 (API 레벨)
 */

const FIXTURE_DIR = path.resolve("fixtures/todo-app/dist");

/** 장면 1(할 일 목록)·장면 2(통계)의 부착 대상과 입력값. 마커 위치 검증에 재사용. */
const SCENE1 = [
  { target: "#add-todo", title: "추가 버튼", desc: "클릭 시 입력값이 할 일 목록 맨 아래에 추가된다." },
  { target: "#new-todo", title: "할 일 입력창", desc: "빈 값이면 추가 버튼이 동작하지 않는다." },
] as const;
const SCENE2 = [
  { target: "#filter-all", title: "전체 필터", desc: "모든 할 일을 통계에 포함한다." },
  { target: "#filter-done", title: "완료 필터", desc: "완료된 할 일만 통계에 포함한다. POL-M 예시." },
] as const;

let fixtureServer: http.Server;
let fixtureUrl: string;

test.beforeAll(async () => {
  // express 라이브러리 없이 순수 http와 fs로 정적 파일 제공
  fixtureServer = http.createServer(async (req, res) => {
    let reqPath = req.url || "/";
    if (reqPath === "/") reqPath = "/index.html";
    if (reqPath.startsWith("/stats")) reqPath = "/index.html"; // history fallback
    
    try {
      const fullPath = path.join(FIXTURE_DIR, reqPath);
      const data = await fs.readFile(fullPath);
      const ext = path.extname(fullPath);
      const mimeTypes: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      res.end(data);
    } catch (e) {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, "127.0.0.1", () => {
      const addr = fixtureServer.address() as any;
      fixtureUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

test.afterAll(() => {
  fixtureServer?.close();
});

async function attachAnnotation(
  page: Page,
  spec: { target: string; title: string; desc: string },
): Promise<void> {
  await page.locator(spec.target).click(); // 편집 모드 캡처 → 어노테이션 생성
  const title = page.locator("[data-ann-title]").last();
  await expect(title).toBeVisible();
  await title.fill(spec.title);
  await page.locator(".ann__desc").last().fill(spec.desc);
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.locator(".save")).toHaveText(/저장됨/);
}

test("S2 DoD: 프록시 URL 등록 → 장면 2/어노테이션 4 → 마스킹 적용 → export 검증", async ({ page, browser, request }, testInfo) => {
  page.on("dialog", (dialog) => void dialog.accept());

  // ── 7. 보안 회귀: 비허용 오리진 및 메타데이터 IP 거부 확인 ───────────────────────────
  const badRes1 = await request.post("/api/projects", {
    data: { name: "Bad", originUrl: "http://example.com" }
  });
  expect(badRes1.status()).toBe(400); // allowlist(localhost,127.0.0.1)에 없음

  const badRes2 = await request.post("/api/projects", {
    data: { name: "Metadata IP", originUrl: "http://169.254.169.254" }
  });
  expect(badRes2.status()).toBe(400);

  // ── 1, 2. 콘솔에서 URL 프록시 프로젝트 등록 ──────────────────────────────────────
  await page.goto("/");
  await page.getByRole("tab", { name: "URL 등록" }).click();
  await page.locator("#url-project-name").fill("Todo 프록시");
  await page.locator("#origin-url").fill(fixtureUrl);
  await page.locator("#url-submit").click();
  await expect(page.locator("#url-status")).toContainText("등록 완료");

  const editorUrl = await page.locator("#url-status a").getAttribute("href");
  expect(editorUrl).toMatch(/^http:\/\/prj_[0-9a-z]+\.localhost:\d+\/$/);

  // ── 3. 편집: 장면 1 (할 일 목록) ──────────────────────────────────
  await page.goto(editorUrl!);
  await expect(page.locator("#todo-list li")).toHaveCount(3); // 프록시 경유 렌더 확인

  await page.locator(".fab").click(); // SDK 주입 정상 확인
  await expect(page.locator(".panel")).toBeVisible();

  const registerScene = page.getByRole("button", { name: "+ 현재 화면 등록" });
  await expect(registerScene).toBeEnabled();
  await registerScene.click();
  await expect(page.locator(".frz--ok")).toHaveCount(1);

  for (const spec of SCENE1) await attachAnnotation(page, spec);
  await expectSaved(page);

  // ── 3. 편집: 장면 2 (/stats — history 라우팅) ─────────────────────
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.locator("#nav-stats").click();
  await expect(page.locator("#stats-line")).toBeVisible();
  await expect(page).toHaveURL(/\/stats$/);

  await page.getByRole("button", { name: "편집", exact: true }).click();
  await registerScene.click();
  await expect(page.locator(".frz--ok")).toHaveCount(2);

  for (const spec of SCENE2) await attachAnnotation(page, spec);
  await expectSaved(page);

  // ── 4. 마스킹 규칙 1건 추가 및 일괄 적용 ───────────────────────────────────
  await page.goto("/");
  await page.getByRole("button", { name: "마스킹 편집" }).first().click();
  await expect(page.locator("#masking-modal")).toHaveClass(/is-open/);
  
  await page.getByRole("button", { name: "+ 규칙 추가" }).click();
  const findInput = page.locator(".c-mask-row input").nth(0);
  const replaceInput = page.locator(".c-mask-row input").nth(1);
  await findInput.fill("보고");
  await replaceInput.fill("마스킹결과");

  await page.locator("#masking-apply").click();
  // 모달 닫힐 때까지 대기
  await expect(page.locator("#masking-modal")).not.toHaveClass(/is-open/);

  // ── 5. 콘솔에서 export → 다운로드 ────────────────────────────────
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기" }).first().click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath("todo-proxy-export.html");
  await download.saveAs(exportPath);
  expect((await fs.stat(exportPath)).size).toBeGreaterThan(10_000);

  // ── 6. 새 컨텍스트에서 file:// 오픈 + 검증 ─────────
  const offline = await browser.newContext();
  const viewer = await offline.newPage();
  const requests: string[] = [];
  viewer.on("request", (req) => requests.push(req.url()));

  await viewer.goto(`file://${exportPath}`);

  // 원문 문자열 0회, 치환문 존재 확인 (스냅샷 HTML 내부만 검사)
  const exportedHtml = await fs.readFile(exportPath, "utf-8");
  const snapMatches = [...exportedHtml.matchAll(/data-snapshot="[^"]+"[^>]*>([^<]+)<\/script>/g)];
  expect(snapMatches.length).toBeGreaterThan(0);
  let maskedFound = false;
  for (const match of snapMatches) {
    const decoded = Buffer.from(match[1]!, "base64").toString("utf8");
    expect(decoded).not.toContain("보고");
    if (decoded.includes("마스킹결과")) {
      maskedFound = true;
    }
  }
  expect(maskedFound).toBe(true);

  // 장면 2개
  const sceneButtons = viewer.locator(".ms-scene-button");
  await expect(sceneButtons).toHaveCount(2);

  const verifyScene = async (specs: typeof SCENE1 | typeof SCENE2) => {
    const markers = viewer.locator(".ms-marker");
    await expect(markers).toHaveCount(2);
    // 마스킹으로 인해 요소 텍스트가 변경되어 앵커가 fallback(is-uncertain)을 탈 수 있으므로,
    // uncertain 여부 대신 위치 오차(<=2px)만 검증한다.

    for (const [i, spec] of specs.entries()) {
      const number = String(i + 1);
      const delta = await viewer.evaluate(
        ({ selector, num }) => {
          const iframe = document.querySelector<HTMLIFrameElement>(".ms-frame");
          const el = iframe?.contentDocument?.querySelector(selector);
          const markerEl = Array.from(document.querySelectorAll<HTMLElement>(".ms-marker"))
            .find((m) => m.textContent === num);
          if (!el || !markerEl) return null;
          const rect = el.getBoundingClientRect();
          const sx = iframe?.contentWindow?.scrollX ?? 0;
          const sy = iframe?.contentWindow?.scrollY ?? 0;
          // 뷰어와 동일 규칙: 문서 좌표(rect+scroll) 기준, 마커 잘림 방지 14px 클램프
          return {
            dx: Math.abs(parseFloat(markerEl.style.left) - Math.max(14, rect.left + sx)),
            dy: Math.abs(parseFloat(markerEl.style.top) - Math.max(14, rect.top + sy)),
          };
        },
        { selector: spec.target, num: number },
      );
      expect(delta, `${spec.target} 마커(${number}) 위치`).not.toBeNull();
      expect(delta!.dx, `${spec.target} 마커 x 오차`).toBeLessThanOrEqual(2);
      expect(delta!.dy, `${spec.target} 마커 y 오차`).toBeLessThanOrEqual(2);
      
      const item = viewer.locator(".ms-annotation").nth(i);
      await expect(item).toContainText(spec.title);
      await expect(item).toContainText(spec.desc);
    }
  };

  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-001");
  await verifyScene(SCENE1);

  await sceneButtons.nth(1).click();
  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-002");
  await verifyScene(SCENE2);

  // 네트워크 요청 0건: 문서 자체(file://) 1건 외 어떤 요청도 없어야 한다
  const external = requests.filter((u) => !u.startsWith("file://"));
  expect(external, "외부(비 file://) 요청").toEqual([]);
  expect(requests, "file:// 요청은 문서 1건뿐").toHaveLength(1);

  await offline.close();
});
