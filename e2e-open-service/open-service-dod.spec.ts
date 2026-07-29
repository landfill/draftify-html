import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  test,
  expect,
  type BrowserContext,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

/**
 * W9 — 공개 서비스 Definition of Done (킥오프 open-service-kickoff-spec.md §10).
 *
 * 1. 공개 URL 접속 → 이메일 링크로 로그인(신규 사용자)
 * 2. 샘플 SPA 목업(zip) 업로드 → 브라우저 unzip + Storage 직업로드 + SDK 주입
 * 3. `/m/{id}/`에서 편집 화면 열림(소유자 인증 경유) → 화면 2개·어노테이션 각 2개·설명
 * 4. export → 산출물 HTML을 새 브라우저 컨텍스트에서 file://로 오픈
 * 5. 검증: 화면 전환·마커 4개 위치(≤2px)·설명 일치·네트워크 요청 0건
 * 6. 격리 회귀: 다른 사용자로 로그인해 1번 사용자의 spec·목업·asset 접근 차단
 * 7. 예약 경로 회귀: SDK가 `/__mockspec/sdk.js`로 로드되고 저장이 `/__mockspec/api`로 성립
 *
 * 실 Supabase에 붙는다(로컬 스택 아님). `apps/web/.env.local`이 없으면 전체 스킵.
 */

/**
 * **상대 base 빌드** 변형을 쓴다(`npm run fixtures:zip:relative`).
 * 공개판은 `/m/{id}/` 경로 접두 서빙이라 루트 base 빌드(`/assets/...`)는 접두 밖으로 나가 깨진다
 * (킥오프 §7.1 알려진 제약 — 사내판은 서브도메인이라 둘 다 동작해서 기존 fixture는 루트 base다).
 */
const ZIP_PATH = path.resolve("fixtures/todo-app-relative.zip");

const SCENE1 = [
  { target: "#add-todo", title: "추가 버튼", desc: "클릭 시 입력값이 할 일 목록 맨 아래에 추가된다." },
  { target: "#new-todo", title: "할 일 입력창", desc: "빈 값이면 추가 버튼이 동작하지 않는다." },
] as const;
const SCENE2 = [
  { target: "#filter-all", title: "전체 필터", desc: "모든 할 일을 통계에 포함한다." },
  { target: "#filter-done", title: "완료 필터", desc: "완료된 할 일만 통계에 포함한다." },
] as const;

const hasEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    process.env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_"),
);

type Admin = SupabaseClient;

function adminClient(): Admin {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** 신규 사용자 생성. 실제 가입과 동일하게 이 테스트 실행마다 새 계정이다. */
async function createUser(admin: Admin, tag: string): Promise<{ id: string; email: string }> {
  const email = `w9-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@draftify.invalid`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser 실패");
  return { id: data.user.id, email };
}

/**
 * 이메일 매직링크 로그인 — 메일 발송만 건너뛰고 **앱의 실제 확인 경로**를 탄다.
 * `generateLink`가 준 `hashed_token`을 `/auth/confirm`에 넘기면 서버가 `verifyOtp`로 검증해
 * 세션 쿠키를 심는다(사용자가 다른 브라우저에서 링크를 여는 경우와 동일한 경로).
 */
async function signIn(
  admin: Admin,
  context: BrowserContext,
  email: string,
  baseURL: string,
): Promise<Page> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw error ?? new Error("generateLink 실패");

  const page = await context.newPage();
  await page.goto(
    `${baseURL}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page, "로그인 후 콘솔 홈").toHaveURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { name: "새 프로젝트 — ZIP 업로드" })).toBeVisible();
  return page;
}

async function attachAnnotation(
  page: Page,
  spec: { target: string; title: string; desc: string },
): Promise<void> {
  await page.locator(spec.target).click(); // 편집 모드 클릭 → 어노테이션 생성
  const title = page.locator("[data-ann-title]").last();
  await expect(title).toBeVisible();
  await title.fill(spec.title);
  await page.locator(".ann__desc").last().fill(spec.desc);
}

async function expectSaved(page: Page): Promise<void> {
  await expect(page.locator(".save")).toHaveText(/저장됨/);
}

/** Storage projects/{id}/ 전체 삭제(재귀) — 정리용. */
async function removeStorage(admin: Admin, projectId: string): Promise<void> {
  const dirs = [`projects/${projectId}`];
  const paths: string[] = [];
  while (dirs.length > 0) {
    const dir = dirs.pop()!;
    const { data } = await admin.storage.from("mockups").list(dir, { limit: 1000 });
    for (const item of data ?? []) {
      const p = `${dir}/${item.name}`;
      if (item.id) paths.push(p);
      else dirs.push(p);
    }
  }
  if (paths.length > 0) await admin.storage.from("mockups").remove(paths);
}

test.describe("공개 서비스 DoD (W9)", () => {
  test.skip(!hasEnv, "apps/web/.env.local(Supabase 키)이 없으면 스킵");

  const admin = hasEnv ? adminClient() : (null as unknown as Admin);
  const created: { userIds: string[]; projectIds: string[] } = { userIds: [], projectIds: [] };

  test.afterAll(async () => {
    if (!hasEnv) return;
    for (const id of created.projectIds) await removeStorage(admin, id).catch(() => undefined);
    for (const id of created.userIds) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  });

  test("가입→업로드→편집→export→뷰어 + 격리·예약 경로 회귀", async ({ browser, baseURL }, testInfo) => {
    test.slow();
    const userA = await createUser(admin, "a");
    created.userIds.push(userA.id);

    const contextA = await browser.newContext();
    // ── 1. 로그인 ────────────────────────────────────────────────────
    const page = await signIn(admin, contextA, userA.email, baseURL!);
    page.on("dialog", (d) => void d.accept());

    // ── 2. zip 업로드 (브라우저 unzip → Storage 직업로드 → complete) ──
    await page.locator("#project-name").fill("Todo 목업");
    await page.locator("#project-owner").fill("김기획");
    await page.locator("#project-zip").setInputFiles(ZIP_PATH);
    await page.getByRole("button", { name: "업로드" }).click();
    await expect(page.locator("#upload-status")).toContainText("업로드 완료", { timeout: 60_000 });

    const editorPath = await page.locator("#upload-status a").getAttribute("href");
    expect(editorPath, "편집 열기 링크").toMatch(/^\/m\/prj_[0-9a-z]+\/$/);
    const projectId = editorPath!.split("/")[2]!;
    created.projectIds.push(projectId);

    // ── 7. 예약 경로 회귀: SDK 로드·저장 경로를 관측한다 ──────────────
    const sdkResponsePromise = page.waitForResponse(
      (r) => r.url().includes("/__mockspec/sdk.js") && r.request().method() === "GET",
    );
    const savePaths: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "PUT" || req.method() === "POST") {
        const u = new URL(req.url());
        if (u.pathname.includes("/api/projects/")) savePaths.push(u.pathname);
      }
    });

    // ── 3. 편집 화면(/m/{id}/) — 소유자 인증 경유 ─────────────────────
    await page.goto(editorPath!);
    await expect(page.locator("#todo-list li"), "목업 자체 렌더").toHaveCount(3);
    expect(await page.locator("base").first().getAttribute("href")).toBe(`/m/${projectId}/`);

    const sdkResponse = await sdkResponsePromise;
    expect(sdkResponse.status(), "SDK 번들 200").toBe(200);
    const sdkBody = await sdkResponse.text();
    expect(sdkBody.length, "플레이스홀더가 아닌 실제 번들").toBeGreaterThan(100_000);
    expect(sdkBody).not.toContain("SDK 번들이 아직 빌드되지 않았습니다");

    await page.locator(".fab").click();
    await expect(page.locator(".panel")).toBeVisible();

    const registerScene = page.getByRole("button", { name: "+ 현재 화면 등록" });
    await expect(registerScene).toBeEnabled();
    await registerScene.click();
    await expect(page.locator(".frz--ok"), "등록 즉시 자동 캡처").toHaveCount(1);

    for (const spec of SCENE1) await attachAnnotation(page, spec);
    await expectSaved(page);

    // 화면 2 — SPA history 라우팅 후 등록 제안 배너로 등록
    await page.getByRole("button", { name: "미리보기" }).click();
    await page.locator("#nav-stats").click();
    await expect(page.locator("#stats-line")).toBeVisible();

    const routeBanner = page.locator(".route-banner");
    await expect(routeBanner).toContainText("새 화면으로 등록할까요?");
    await page.getByRole("button", { name: "편집", exact: true }).click();
    await routeBanner.getByRole("button", { name: "등록", exact: true }).click();
    await expect(page.locator(".frz--ok")).toHaveCount(2);

    for (const spec of SCENE2) await attachAnnotation(page, spec);
    await expectSaved(page);

    expect(
      savePaths.filter((p) => p.startsWith("/__mockspec/api/projects/")).length,
      "저장이 예약 경로(/__mockspec/api)로 나갔다",
    ).toBeGreaterThan(0);
    expect(savePaths.some((p) => p.includes("/assets")), "스냅샷 업로드도 예약 경로").toBe(true);

    // ── 4. export (편집 패널) ────────────────────────────────────────
    const downloadPromise = page.waitForEvent("download");
    await page.locator(".btn--export").click();
    const download = await downloadPromise;
    const exportPath = testInfo.outputPath("open-service-export.html");
    await download.saveAs(exportPath);
    expect((await fs.stat(exportPath)).size).toBeGreaterThan(10_000);

    // ── 5. 새 컨텍스트에서 file:// — 완전 오프라인 검증 ───────────────
    const offline = await browser.newContext();
    const viewer = await offline.newPage();
    const requests: string[] = [];
    viewer.on("request", (req) => requests.push(req.url()));
    await viewer.goto(`file://${exportPath}`);

    const sceneButtons = viewer.locator(".ms-scene-button");
    await expect(sceneButtons).toHaveCount(2);
    await expect(viewer.locator(".ms-title")).toContainText("Todo 목업 기획서");
    await expect(viewer.locator(".ms-header .ms-meta"), "작성자 라벨·집계").toContainText(
      "작성자 김기획 · 생성:",
    );
    await expect(viewer.locator(".ms-header .ms-meta")).toContainText("화면 2 · 어노테이션 4");

    const verifyScene = async (specs: typeof SCENE1 | typeof SCENE2) => {
      const markers = viewer.locator(".ms-marker");
      await expect(markers).toHaveCount(2);
      await expect(viewer.locator(".ms-marker.is-uncertain"), "앵커 해석 성공").toHaveCount(0);

      for (const [i, spec] of specs.entries()) {
        const num = String(i + 1);
        const delta = await viewer.evaluate(
          ({ selector, n }) => {
            const iframe = document.querySelector<HTMLIFrameElement>(".ms-frame");
            const el = iframe?.contentDocument?.querySelector(selector);
            const markerEl = Array.from(document.querySelectorAll<HTMLElement>(".ms-marker")).find(
              (m) => m.textContent === n,
            );
            if (!el || !markerEl) return null;
            const rect = el.getBoundingClientRect();
            const sx = iframe?.contentWindow?.scrollX ?? 0;
            const sy = iframe?.contentWindow?.scrollY ?? 0;
            return {
              dx: Math.abs(parseFloat(markerEl.style.left) - Math.max(14, rect.left + sx)),
              dy: Math.abs(parseFloat(markerEl.style.top) - Math.max(14, rect.top + sy)),
            };
          },
          { selector: spec.target, n: num },
        );
        expect(delta, `${spec.target} 마커(${num})`).not.toBeNull();
        expect(delta!.dx, `${spec.target} x 오차`).toBeLessThanOrEqual(2);
        expect(delta!.dy, `${spec.target} y 오차`).toBeLessThanOrEqual(2);

        const item = viewer.locator(".ms-annotation").nth(i);
        await expect(item).toContainText(spec.title);
        await expect(item).toContainText(spec.desc);
      }
    };

    await verifyScene(SCENE1);
    await sceneButtons.nth(1).click();
    await verifyScene(SCENE2);

    const external = requests.filter((u) => !u.startsWith("file://"));
    expect(external, "외부 요청 0건").toEqual([]);
    expect(requests, "file:// 요청은 문서 1건뿐").toHaveLength(1);
    await offline.close();

    // ── 6. 격리 회귀: 다른 사용자는 A의 것에 접근 못 한다 ─────────────
    const userB = await createUser(admin, "b");
    created.userIds.push(userB.id);
    const contextB = await browser.newContext();
    const pageB = await signIn(admin, contextB, userB.email, baseURL!);

    await expect(pageB.locator(".c-empty"), "B의 목록은 비어 있다").toContainText(
      "아직 프로젝트가 없습니다",
    );

    const apiB: APIRequestContext = pageB.request;
    const listB = await apiB.get("/api/projects");
    expect(listB.ok()).toBe(true);
    expect(JSON.stringify(await listB.json()), "B 목록에 A 프로젝트 없음").not.toContain(projectId);

    const specB = await apiB.get(`/api/projects/${projectId}`);
    expect([401, 403, 404], `spec 접근 차단 (실제 ${specB.status()})`).toContain(specB.status());
    expect(await specB.text()).not.toContain("annotations");

    const mockupB = await apiB.get(`/m/${projectId}/`);
    expect([401, 403, 404], `목업 서빙 차단 (실제 ${mockupB.status()})`).toContain(
      mockupB.status(),
    );

    // asset 키는 A의 spec에서 얻는다(admin으로 조회) → B가 그 키로 직접 요청
    const { data: row } = await admin.from("projects").select("spec").eq("id", projectId).single();
    const assetKey = (row!.spec as { scenes: { snapshotAsset?: string }[] }).scenes.find(
      (s) => s.snapshotAsset,
    )?.snapshotAsset;
    expect(assetKey, "A의 스냅샷 asset 키").toBeTruthy();
    const assetB = await apiB.get(`/api/projects/${projectId}/assets/${assetKey}`);
    expect([401, 403, 404], `asset 접근 차단 (실제 ${assetB.status()})`).toContain(assetB.status());

    // Storage 직접 접근도 RLS가 막는다(공개 키 클라이언트 = B 세션 아님, 익명)
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: anonDl, error: anonErr } = await anon.storage
      .from("mockups")
      .download(`projects/${projectId}/mockup/index.html`);
    expect(anonDl, "익명 Storage 다운로드 차단").toBeNull();
    expect(anonErr).not.toBeNull();

    await contextB.close();
    await contextA.close();
  });
});
