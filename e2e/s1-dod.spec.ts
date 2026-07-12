import fs from "node:fs/promises";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";

/**
 * S1 Definition of Done 시나리오 (technical-spec §9.1).
 *
 * 1. 샘플 SPA 목업(fixtures/todo-app.zip) 업로드 — 콘솔 UI로
 * 2. 편집 화면에서 장면 2개 등록, 어노테이션 각 2개 부착·설명 입력
 * 3. export → 산출물 HTML을 새 브라우저 컨텍스트에서 file://로 오픈
 * 4. 검증: 장면 2개 전환 / 마커 4개가 올바른 요소 위 / 설명 텍스트 일치 / 네트워크 요청 0건
 */

const ZIP_PATH = path.resolve("fixtures/todo-app.zip");

/** 장면 1(할 일 목록)·장면 2(통계)의 부착 대상과 입력값. 마커 위치 검증에 재사용. */
const SCENE1 = [
  { target: "#add-todo", title: "추가 버튼", desc: "클릭 시 입력값이 할 일 목록 맨 아래에 추가된다." },
  { target: "#new-todo", title: "할 일 입력창", desc: "빈 값이면 추가 버튼이 동작하지 않는다." },
] as const;
const SCENE2 = [
  { target: "#filter-all", title: "전체 필터", desc: "모든 할 일을 통계에 포함한다." },
  { target: "#filter-done", title: "완료 필터", desc: "완료된 할 일만 통계에 포함한다. POL-M 예시." },
] as const;

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

test("S1 DoD: 업로드 → 장면 2·어노테이션 4 → export → file:// 오프라인 검증", async ({ page, browser }, testInfo) => {
  // 동결 실패 등으로 confirm이 뜨면 명시적으로 실패시키기보다 진행 후 검증에서 잡는다
  page.on("dialog", (dialog) => void dialog.accept());

  // ── 1. 콘솔에서 zip 업로드 ─────────────────────────────────────────
  await page.goto("/");
  await page.locator("#project-name").fill("Todo 목업");
  await page.locator("#project-zip").setInputFiles(ZIP_PATH);
  await page.locator("#upload-submit").click();
  await expect(page.locator("#upload-status")).toContainText("업로드 완료");

  const editorUrl = await page.locator("#upload-status a").getAttribute("href");
  expect(editorUrl).toMatch(/^http:\/\/prj_[0-9a-z]+\.localhost:\d+\/$/);

  // ── 2. 편집: 장면 1 (할 일 목록) ──────────────────────────────────
  await page.goto(editorUrl!);
  await expect(page.locator("#todo-list li")).toHaveCount(3); // 목업 자체 렌더 확인

  await page.locator(".fab").click(); // Shadow DOM은 Playwright가 관통
  await expect(page.locator(".panel")).toBeVisible();

  const registerScene = page.getByRole("button", { name: "+ 현재 화면 등록" });
  await expect(registerScene).toBeEnabled(); // 프로젝트 로드 완료
  await registerScene.click();
  await expect(page.locator(".frz--ok")).toHaveCount(1); // ✓ 동결됨 (등록 즉시 자동 동결)

  for (const spec of SCENE1) await attachAnnotation(page, spec);
  await expectSaved(page);

  // ── 2. 편집: 장면 2 (/stats — history 라우팅) ─────────────────────
  await page.getByRole("button", { name: "미리보기" }).click();
  await page.locator("#nav-stats").click(); // 미리보기 모드는 목업 클릭 통과
  await expect(page.locator("#stats-line")).toBeVisible();
  await expect(page).toHaveURL(/\/stats$/);

  await page.getByRole("button", { name: "편집", exact: true }).click();
  await registerScene.click();
  await expect(page.locator(".frz--ok")).toHaveCount(2);

  for (const spec of SCENE2) await attachAnnotation(page, spec);
  await expectSaved(page);

  // ── 3. 콘솔에서 export → 다운로드 ────────────────────────────────
  await page.goto("/");
  await expect(page.locator(".c-project-meta")).toContainText("화면 2 · 어노테이션 4");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "내보내기" }).click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath("todo-mockup-export.html");
  await download.saveAs(exportPath);
  expect((await fs.stat(exportPath)).size).toBeGreaterThan(10_000);

  // ── 4. 새 컨텍스트에서 file:// 오픈 + 완전 오프라인 검증 ─────────
  const offline = await browser.newContext();
  const viewer = await offline.newPage();
  const requests: string[] = [];
  viewer.on("request", (req) => requests.push(req.url()));

  await viewer.goto(`file://${exportPath}`);

  // 장면 2개 — 사이드바에 SCR-001·SCR-002
  const sceneButtons = viewer.locator(".ms-scene-button");
  await expect(sceneButtons).toHaveCount(2);
  await expect(sceneButtons.nth(0)).toContainText("SCR-001");
  await expect(sceneButtons.nth(1)).toContainText("SCR-002");

  // 장면별 검증 헬퍼: 마커 2개가 "올바른 요소 위"(대상 우상단) + 설명 텍스트 일치
  const verifyScene = async (specs: typeof SCENE1 | typeof SCENE2) => {
    const markers = viewer.locator(".ms-marker");
    await expect(markers).toHaveCount(2);
    await expect(viewer.locator(".ms-marker.is-uncertain")).toHaveCount(0); // 앵커 해석 성공

    for (const [i, spec] of specs.entries()) {
      const number = String(i + 1); // 장면 내 번호 (POL-M01)
      const delta = await viewer.evaluate(
        ({ selector, num }) => {
          const iframe = document.querySelector<HTMLIFrameElement>(".ms-frame");
          const el = iframe?.contentDocument?.querySelector(selector);
          const markerEl = Array.from(document.querySelectorAll<HTMLElement>(".ms-marker"))
            .find((m) => m.textContent === num);
          if (!el || !markerEl) return null;
          const rect = el.getBoundingClientRect();
          return {
            dx: Math.abs(parseFloat(markerEl.style.left) - rect.right),
            dy: Math.abs(parseFloat(markerEl.style.top) - rect.top),
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

  // 장면 1 검증 → 장면 2로 전환 → 검증 → 다시 장면 1로 (전환 왕복)
  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-001");
  await verifyScene(SCENE1);

  await sceneButtons.nth(1).click();
  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-002");
  await verifyScene(SCENE2);

  await sceneButtons.nth(0).click();
  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-001");

  // 마커 ↔ 목록 상호 하이라이트
  await viewer.locator(".ms-marker", { hasText: "1" }).click();
  await expect(viewer.locator(".ms-annotation.is-active")).toContainText(SCENE1[0].title);

  // 네트워크 요청 0건: 문서 자체(file://) 1건 외 어떤 요청도 없어야 한다
  const external = requests.filter((u) => !u.startsWith("file://"));
  expect(external, "외부(비 file://) 요청").toEqual([]);
  expect(requests, "file:// 요청은 문서 1건뿐").toHaveLength(1);

  await offline.close();
});
