import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodeConnection } from "@mockspec/shared";
import {
  test,
  expect,
  request,
  type BrowserContext,
  type Page,
  type APIRequestContext,
  type Dialog,
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

/**
 * #43 — 배포 ZIP이 지켜야 할 계약. 압축을 푼 `mockspec-extension/` 폴더 하나를
 * chrome://extensions에서 그대로 고를 수 있어야 한다.
 * 패키징 스크립트(`apps/web/scripts/package-extension.mjs`)의 상수를 import하지 않고
 * 여기에 따로 적는다 — 스크립트가 잘못 바뀌면 이 테스트가 잡아야 하기 때문이다.
 */
const EXTENSION_ARCHIVE_ROOT = "mockspec-extension";
const EXPECTED_EXTENSION_ENTRIES = [
  "background.js",
  "content.js",
  "icons/icon-128.png",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "manifest.json",
  "popup.html",
  "popup.js",
  "sdk.js",
]
  .map((file) => `${EXTENSION_ARCHIVE_ROOT}/${file}`)
  .sort();

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
  await expect(page.getByRole("heading", { name: "새 프로젝트 시작" })).toBeVisible();
  // 기본 선택 탭은 ZIP 업로드 (#51).
  await expect(page.getByRole("tab", { name: "ZIP 업로드" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
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

    // 좌측 화면목록은 없다 — 화면영역 + 디스크립션 2컬럼이고 이동은 하단 전/후 컨트롤이
    // 담당한다 (s1-kickoff 11절 19차, 이슈 #86)
    await expect(viewer.locator(".ms-sidebar")).toHaveCount(0);
    const navButtons = viewer.locator(".ms-nav-btn");
    await expect(viewer.locator(".ms-nav-position")).toHaveText("1 / 2");
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
    await navButtons.nth(1).click();
    await expect(viewer.locator(".ms-nav-position")).toHaveText("2 / 2");
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

  /**
   * 이슈 #46 — 크로스 디바이스 로그인. 다른 기기에서 링크를 열면 PKCE code_verifier가 없어
   * `/auth/callback`은 실패한다. 그래서 메일 링크는 `/auth/confirm?token_hash=…&type=…`로
   * 가야 하고, 그 형태는 Supabase **이메일 템플릿 설정**으로만 바뀐다(코드 아님).
   *
   * 여기서 고정하는 것: `/auth/confirm`이 **어떤 `type` 값으로 설정하든 견디는가.**
   * 라우트는 `type`을 `verifyOtp`에 그대로 넘기므로 세 값이 모두 성립한다.
   *
   * **설정할 템플릿은 「Magic link or OTP」 하나뿐이다.** `signInWithOtp`로 자동 생성되는
   * 신규 사용자도 이 템플릿을 받는다 — `Confirm sign up`은 비밀번호 가입(`/signup`) 경로용이고
   * 이 앱은 그 경로를 쓰지 않는다. 넣을 값은 Supabase 문서 권장 형태인 **`type=email`**.
   * `magiclink`는 E2E의 `signIn()` 헬퍼가 쓰는 값이고, `signup`은 라우트 커버리지일 뿐
   * **프로덕션 로그인 퍼널의 요구사항이 아니다**(설정을 이 값으로 하면 안 된다).
   *
   * 이 테스트는 링크를 **새 브라우저 컨텍스트**에서 연다 = 요청한 기기와 다른 기기.
   */
  for (const type of ["email", "magiclink", "signup"] as const) {
    test(`크로스 디바이스 로그인 — /auth/confirm?type=${type} (#46)`, async ({
      browser,
      baseURL,
    }) => {
      // `type: "signup"`은 **사용자를 새로 만드는** API라 미리 만들어 두면 "already registered"로
      // 거부된다(그리고 password가 필수다 — 링크 검증에는 쓰이지 않는다). `magiclink`는 반대로
      // 기존 사용자가 있어야 한다. 두 흐름의 전제가 달라 여기서 갈라 준비한다.
      let email: string;
      let userId: string;
      let tokenHash: string | undefined;

      if (type === "signup") {
        email = `w9-c46-signup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@draftify.invalid`;
        const { data, error } = await admin.auth.admin.generateLink({
          type,
          email,
          password: `pw-${Math.random().toString(36).slice(2)}A1!`,
        });
        expect(error, "generateLink(signup) 성공").toBeNull();
        userId = data.user!.id;
        tokenHash = data.properties?.hashed_token;
      } else {
        // `email`은 generateLink의 타입이 아니다(발급은 magiclink). 같은 토큰을 템플릿이 보낼
        // `type=email`로 검증했을 때도 성립하는지가 이 케이스의 요점이다.
        const user = await createUser(admin, `c46-${type}`);
        email = user.email;
        userId = user.id;
        const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
        expect(error, "generateLink(magiclink) 성공").toBeNull();
        tokenHash = data.properties?.hashed_token;
      }
      created.userIds.push(userId);
      expect(tokenHash, `${type} hashed_token 발급`).toBeTruthy();

      // 링크를 요청한 브라우저가 아닌 **다른 컨텍스트**에서 연다 → code_verifier가 없다.
      const other = await browser.newContext();
      const page = await other.newPage();
      await page.goto(`${baseURL}/auth/confirm?token_hash=${tokenHash}&type=${type}`);

      await expect(page, `${type}: 콘솔 홈으로 진입`).toHaveURL(`${baseURL}/`);
      await expect(
        page.getByRole("button", { name: "로그아웃" }),
        `${type}: 세션이 심겼다`,
      ).toBeVisible();

      await other.close();
    });
  }

  /**
   * 이슈 #65 — 가이드의 명령 예시를 터미널 창으로 바꾸면서 붙은 두 계약을 고정한다.
   *
   * ① 복사 버튼이 **그 줄의 명령만** 클립보드에 넣는다. 프롬프트(`$ `)나 출력이 섞이면
   *    붙여넣기가 그대로 깨지고, 이 UI를 쓰는 이유가 사라진다.
   * ② 좁은 화면에서 **페이지가 아니라 블록만** 가로 스크롤한다. 명령은 길어질 수밖에
   *    없는데, 페이지가 통째로 밀리면 본문 읽기가 망가진다.
   *
   * 모바일 조건(`hasTouch`)으로 도는 이유: 복사 버튼은 평소 hover로만 드러나므로, 터치
   * 기기에서 계속 숨어 있으면 복사를 아예 쓸 수 없다.
   *
   * **이 테스트를 자격증명 게이트(`test.skip(!hasEnv)`) 밖으로 빼지 말 것.** `/guide`는
   * Supabase를 쓰지 않지만, `.env.local`이 없으면 **앱 자체가 뜨지 않는다** — 미들웨어가
   * 공개 경로에서도 세션 갱신을 위해 Supabase 클라이언트를 만들고(헤더 로그인 상태를 맞추기
   * 위해 필요하다 — PR #53 회귀), 키가 없으면 거기서 throw해 `webServer`가 기동 타임아웃으로
   * 죽는다. 게이트 밖으로 빼면 "자격증명 없이도 도는 테스트"가 되는 게 아니라 **스킵이
   * 실패로 바뀔 뿐이다.** (PR #76 Codex 지적을 실측으로 확인한 결과.)
   */
  test("가이드 터미널 블록 — 명령만 복사, 페이지가 아닌 블록만 가로 스크롤 (#65)", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    // 가이드는 로그인 없이 보는 공개 페이지다. 복사 버튼은 클라이언트 컴포넌트라
    // 하이드레이션 전에 누르면 클릭이 그냥 사라진다 — 로딩이 잦아든 뒤에 만진다.
    await page.goto(`${baseURL}/guide`, { waitUntil: "networkidle" });

    const block = page.locator(".g-term").first();
    await expect(block).toBeVisible();

    const commandLine = block.locator(".g-term-line").first();
    const commandText = (await commandLine.locator("span").first().innerText()).replace(/^\$\s*/, "");
    expect(commandText, "첫 줄은 실행할 명령이다").toBe("npm run build:public");

    // 접근성 이름으로 잡지 않는다 — 복사 후 이름이 "복사됨: …"으로 바뀌므로, 이름에 묶은
    // locator는 클릭 직후 자기가 누른 버튼을 놓친다.
    const copyButton = commandLine.locator(".g-term-copy");
    await expect(copyButton, "터치 기기에서도 복사 버튼이 보여야 한다").toBeVisible();
    await expect(copyButton).toHaveCSS("opacity", "1");
    await expect(copyButton).toHaveAttribute("aria-label", `명령 복사: ${commandText}`);

    await copyButton.click();
    // "복사됨"은 클립보드 쓰기가 resolve된 뒤에만 뜬다(terminal-block.tsx의 handleCopy).
    // 재시도 assertion인 이 줄을 먼저 통과시켜야, 아래 readText()가 쓰기 완료 전에 읽어
    // 간헐 실패하는 일이 없다.
    await expect(copyButton).toHaveText("복사됨");
    expect(await page.evaluate(() => navigator.clipboard.readText()), "프롬프트·출력 없이 명령만").toBe(
      commandText,
    );

    // `aria-label`은 버튼 안 텍스트를 덮어쓴다 — 라벨이 고정이면 화면은 "복사됨"인데
    // 스크린리더에는 계속 "명령 복사"로 들린다. 라벨과 라이브 리전 둘 다 상태를 반영해야 한다.
    await expect(copyButton).toHaveAttribute("aria-label", `복사됨: ${commandText}`);
    // 페이지에 터미널 블록이 여럿이라 status도 여럿이다 — 누른 블록 것만 본다.
    const status = block.getByRole("status");
    await expect(status).toHaveText(`${commandText} 명령을 클립보드에 복사했습니다.`);

    // 한 블록에 복사 버튼이 여럿이다. 알림 문구가 고정이면 다음 명령을 복사해도 텍스트 노드가
    // 그대로여서 React가 DOM을 건드리지 않고, 스크린리더는 두 번째 성공을 알리지 않는다.
    const secondCommandLine = block.locator(".g-term-line", { has: page.locator(".g-term-copy") }).nth(1);
    const secondCommand = (await secondCommandLine.locator("span").first().innerText()).replace(
      /^\$\s*/,
      "",
    );
    expect(secondCommand, "같은 블록의 두 번째 명령").not.toBe(commandText);
    await secondCommandLine.locator(".g-term-copy").click();
    await expect(status).toHaveText(`${secondCommand} 명령을 클립보드에 복사했습니다.`);

    const scroll = await page.evaluate(() => {
      const el = document.documentElement;
      const body = document.querySelector(".g-term-body")!;
      return {
        page: el.scrollWidth > el.clientWidth,
        block: body.scrollWidth > body.clientWidth,
      };
    });
    expect(scroll.page, "페이지는 가로로 밀리지 않는다").toBe(false);
    expect(scroll.block, "긴 명령은 블록 안에서 스크롤된다").toBe(true);

    await context.close();
  });

  /**
   * 헤더 로그인 상태가 페이지마다 어긋나던 회귀. `/guide`·`/faq`는 로그인 없이 보는 정적
   * 페이지라 서버가 `email` prop을 주지 않는데, 헤더가 그 prop만 보고 판단해서 **로그인한
   * 사용자에게도 [로그인]** 을 보여줬다(콘솔 홈은 [로그아웃]). 헤더가 자기 세션을 직접
   * 확인하게 고쳤고, 여기서 세 화면의 일관성을 고정한다.
   */
  test("헤더 로그인 상태 — 콘솔·가이드·FAQ가 일관되게 [로그아웃]", async ({ browser, baseURL }) => {
    const user = await createUser(admin, "h");
    created.userIds.push(user.id);

    const context = await browser.newContext();
    const page = await signIn(admin, context, user.email, baseURL!);

    for (const path of ["/", "/guide", "/faq"]) {
      await page.goto(`${baseURL}${path}`);
      await expect(
        page.getByRole("button", { name: "로그아웃" }),
        `${path} 헤더에 로그아웃`,
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "로그인" }),
        `${path} 헤더에 로그인 링크 없음`,
      ).toHaveCount(0);

      // 이슈 #77 — 작업 기점으로 돌아올 길이 로고뿐이면 처음 쓰는 사람이 찾지 못한다.
      const consoleLink = page.locator(".c-header").getByRole("link", { name: "내 프로젝트" });
      await expect(consoleLink, `${path} 헤더에 프로젝트 목록 링크`).toBeVisible();
      await expect(consoleLink).toHaveAttribute("href", "/");
      // 콘솔에 있을 때만 활성 표시 — 다른 내비 항목과 같은 규칙이다.
      await expect(consoleLink, `${path} 활성 표시`).toHaveClass(
        path === "/" ? /is-active/ : /^(?!.*is-active).*$/,
      );
    }

    // 로그아웃 상태에서는 반대로 나와야 한다 — 정적 페이지도 포함.
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    for (const path of ["/", "/guide", "/faq"]) {
      await anonPage.goto(`${baseURL}${path}`);
      await expect(
        anonPage.getByRole("link", { name: "로그인" }),
        `${path} 비로그인 헤더에 로그인 링크`,
      ).toBeVisible();
      await expect(
        anonPage.getByRole("button", { name: "로그아웃" }),
        `${path} 비로그인 헤더에 로그아웃 없음`,
      ).toHaveCount(0);

      // #77 — 로그인 없이 가이드를 읽던 사람에게도 돌아갈 길이 보여야 한다(사용자 결정).
      // 누르면 로그인 화면으로 가는데, 프로젝트를 보려면 어차피 로그인이 필요하다.
      const anonConsoleLink = anonPage
        .locator(".c-header")
        .getByRole("link", { name: "내 프로젝트" });
      await expect(
        anonConsoleLink,
        `${path} 비로그인 헤더에도 프로젝트 목록 링크`,
      ).toBeVisible();
      await expect(
        anonConsoleLink,
        `${path} 비로그인 작업 링크는 랜딩이 아니라 로그인으로 이동`,
      ).toHaveAttribute("href", "/login");

      if (path === "/") {
        // 이슈 #85 — 공개 서비스 첫 화면이 로그인 폼이 아니라 서비스 설명이어야 한다.
        await expect(
          anonPage.getByRole("heading", { name: "보이는 화면에 설명을 달면, 기획서가 됩니다." }),
        ).toBeVisible();
        await expect(anonPage.getByRole("link", { name: "내 프로젝트 시작" })).toHaveAttribute(
          "href",
          "/login",
        );
        await expect(anonPage.getByRole("link", { name: "샘플 산출물 보기" })).toHaveAttribute(
          "href",
          "/sample",
        );
        await expect(
          anonPage.getByRole("link", { name: /사용 가이드에서 확인하기/ }),
        ).toHaveAttribute("href", "/guide");

        // PR #88 Codex P2 — max-width 컨테이너에 viewport 기반 패딩을 넣으면 초광폭에서
        // 오히려 콘텐츠가 찌그러진다. 2400px에서도 두 시작 경로가 충분한 폭을 유지해야 한다.
        await anonPage.setViewportSize({ width: 2400, height: 1000 });
        const pathCards = anonPage.locator(".l-path-grid article");
        await expect(pathCards).toHaveCount(2);
        const firstPathBox = await pathCards.nth(0).boundingBox();
        const secondPathBox = await pathCards.nth(1).boundingBox();
        expect(firstPathBox!.width, "초광폭에서도 시작 경로 카드 폭 유지").toBeGreaterThan(400);
        expect(secondPathBox!.x + secondPathBox!.width, "시작 경로가 화면 밖으로 나가지 않음")
          .toBeLessThanOrEqual(2400);
        await anonPage.setViewportSize({ width: 1280, height: 720 });
      }
    }

    // #77 — 좁은 화면에서 낱말이 통째로 쪼개지던 문제("MockSpec / Cloud", "사용 가 / 이드").
    // 항목은 줄을 넘기지 않고, 넘칠 때는 항목 단위로 다음 줄로 내려간다.
    //
    // 721px을 함께 보는 이유(PR #78 Codex 지적): 줄바꿈을 특정 폭 아래에서만 켜면 그 경계
    // **바로 위**에서 헤더가 깨진다 — 이메일이 다시 나타나면서 한 줄에 다 들어가지 않는다.
    // 그래서 폭이 아니라 내용이 줄바꿈을 정하게 했고, 여기서 경계 양쪽을 다 확인한다.
    // 로그인 상태(`page`)로 재는 것이 중요하다. 이메일이 있는 쪽이 더 빡빡하다.
    for (const width of [390, 721, 900]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${baseURL}/`);
      const header = await page.evaluate(() => {
        const el = document.documentElement;
        // 링크만 보면 안 된다 — [로그아웃]은 `.c-nav-link`가 아니라 `.c-btn`이라 규칙이
        // 따로 걸리고, 실제로 그 버튼만 "로그 / 아웃"으로 갈렸다 (PR #78 CodeRabbit 지적).
        // 텍스트가 있는 항목 전부를 본다(아이콘뿐인 테마 토글은 textContent가 비어 제외된다).
        const items = [...document.querySelectorAll<HTMLElement>(".c-header a, .c-header button, .c-header span")]
          .filter((n) => (n.textContent ?? "").trim().length > 0);
        /*
          "낱말이 갈렸는가"는 **텍스트가 몇 줄에 걸쳤는가**로 판정한다. 지금까지 세 가지
          오탐을 밟았다:
            ① 요소 **높이**로 재기 → 버튼의 padding을 줄바꿈으로 오인 (#77)
            ② Range 사각형 **개수**로 재기 → `text-overflow: ellipsis`가 같은 줄을 여러
               조각으로 나눈 것까지 잡음 (#77)
            ③ 요소 **전체**를 `selectNodeContents` → 인라인 자식(아이콘 `<svg>`)이 텍스트와
               세로 중앙 정렬돼 top이 몇 px 다른 것을 줄바꿈으로 오인 (#82, [내 프로젝트])
          그래서 **텍스트 노드만** 모아 그 top이 서로 다를 때만 갈린 것으로 본다.
        */
        const splitTexts = (root: HTMLElement): boolean => {
          const tops = new Set<number>();
          for (const node of root.childNodes) {
            if (node.nodeType !== Node.TEXT_NODE) continue;
            if (!(node.textContent ?? "").trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const r of range.getClientRects()) tops.add(Math.round(r.top));
          }
          return tops.size > 1;
        };

        /*
          **판정식을 먼저 역검증한다.** #77에서 판정을 두 번 갈아엎었고 #82에서 또 한 번
          틀렸다 — 판정식을 믿을 수 없으면 "낱말 분리 0건"은 아무것도 보장하지 않는다.
          일부러 좁혀 줄을 넘긴 요소를 만들어, 이 검사가 그것을 잡아내는지 확인한다.
        */
        const probe = document.createElement("div");
        probe.style.cssText =
          "position:fixed;left:-9999px;top:0;width:20px;white-space:normal;font-size:13px";
        probe.textContent = "줄바꿈 역검증용 긴 문자열";
        document.body.appendChild(probe);
        const detectorWorks = splitTexts(probe);
        probe.remove();

        return {
          detectorWorks,
          split: items.filter(splitTexts).map((n) => n.textContent?.trim()),
          overflowsRight: items.some(
            (n) => n.getBoundingClientRect().right > el.clientWidth + 1,
          ),
          pageScrollsX: el.scrollWidth > el.clientWidth,
        };
      });
      // 판정식이 살아 있음을 먼저 확인한다 — 이게 false면 아래 두 줄은 무의미하다.
      expect(header.detectorWorks, `${width}px — 줄바꿈 판정식이 실제 줄바꿈을 잡아낸다`).toBe(
        true,
      );
      expect(header.split, `${width}px — 낱말 안에서 줄바꿈되지 않는다`).toEqual([]);
      expect(header.overflowsRight, `${width}px — 항목이 화면 밖으로 나가지 않는다`).toBe(false);
      expect(header.pageScrollsX, `${width}px — 페이지가 가로로 밀리지 않는다`).toBe(false);
    }

    // 주소가 길어도 헤더를 밀어내지 않도록 잘라 둔다. 위 폭 검사는 테스트 계정 주소 길이에
    // 의존하므로(실측: 721px에서 35자 주소까지 여유 47px), 잘림 자체를 계약으로 못 박는다.
    await page.setViewportSize({ width: 900, height: 844 });
    await page.goto(`${baseURL}/`);
    const emailWidth = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>(".c-user-email");
      if (!el) return null;
      el.textContent = "very.long.name.department@some-very-long-company-domain.example.com";
      const cs = getComputedStyle(el);
      return { rendered: el.getBoundingClientRect().width, overflow: cs.textOverflow };
    });
    expect(emailWidth, "콘솔 헤더에 이메일 표시").not.toBeNull();
    expect(emailWidth!.overflow, "긴 주소는 말줄임").toBe("ellipsis");
    expect(emailWidth!.rendered, "잘린 폭은 상한 이하").toBeLessThanOrEqual(221);

    await anon.close();
    await context.close();
  });

  /**
   * 이슈 #42 — 경로 D(확장) 진입점. W6에서 백엔드(snippet 생성·토큰·Bearer)를 이식했는데
   * W7 콘솔 이식에서 UI가 빠져 **공개판에서 경로 D 프로젝트를 만들 수단이 없었다.**
   * 위 DoD가 경로 A 시나리오만 봐서 놓친 갭이라, 진입점 자체를 여기서 회귀 고정한다.
   */
  test("콘솔 홈 목록은 서버 렌더에 실려 온다 — 첫 화면이 /api/projects를 부르지 않는다 (#81)", async ({
    browser,
    baseURL,
  }) => {
    const user = await createUser(admin, "pf");
    created.userIds.push(user.id);
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await signIn(admin, context, user.email, baseURL!);

    // 이슈 #85 — 첫 사용자는 프로젝트가 없으므로 생성 패널이 먼저, 열린 상태로 보인다.
    const firstCreate = page.locator(".c-new-project-section");
    const firstList = page.locator(".c-project-section");
    await expect(page.locator(".c-new-project")).toHaveAttribute("open", "");
    const firstCreateBox = await firstCreate.boundingBox();
    const firstListBox = await firstList.boundingBox();
    expect(firstCreateBox!.y, "빈 목록에서는 새 프로젝트가 먼저").toBeLessThan(firstListBox!.y);
    await expect(page.locator("main.c-console-home > section").first()).toHaveClass(
      /c-new-project-section/,
    );

    // 목록에 내용이 있어야 "서버가 실어 보냈다"를 확인할 수 있다.
    await page.getByRole("tab", { name: "내 화면에서 편집 (확장)" }).click();
    await page.locator("#snippet-name").fill("프리페치 회귀");
    await page.getByRole("button", { name: "만들고 연결 코드 복사" }).click();
    await expect(page.getByText(/연결 코드를 복사했습니다/)).toBeVisible();
    const created0 = decodeConnection(await page.evaluate(() => navigator.clipboard.readText()));
    created.projectIds.push(created0!.projectId);

    // PR #88 Codex P2 — 새로고침하지 않아도 첫 프로젝트 생성 즉시 재방문 레이아웃이 된다.
    await expect(page.locator(".c-new-project")).not.toHaveAttribute("open", "");
    const creationFeedback = page.locator(".c-creation-feedback");
    await expect(creationFeedback).toContainText(/연결 코드를 복사했습니다/);
    await expect(creationFeedback).toBeFocused();
    const liveListBox = await page.locator(".c-project-section").boundingBox();
    const liveCreateBox = await page.locator(".c-new-project-section").boundingBox();
    expect(liveListBox!.y, "첫 생성 직후 프로젝트 목록이 먼저").toBeLessThan(liveCreateBox!.y);
    await expect(page.locator("main.c-console-home > section").first()).toHaveClass(
      /c-project-section/,
    );

    /*
      ① 서버가 실어 보냈는가 — HTML **문서 자체**에 이름이 들어 있어야 한다.
      화면에 보이는지만 보면 클라이언트가 나중에 채운 경우와 구별되지 않는다.
    */
    const html = await (await context.request.get(`${baseURL}/`)).text();
    expect(html, "목록이 서버 렌더 HTML에 포함된다").toContain("프리페치 회귀");

    // ② 첫 화면이 목록을 **다시** 부르지 않는가.
    const listCalls: string[] = [];
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (r.method() === "GET" && url.pathname === "/api/projects") listCalls.push(url.pathname);
    });

    await page.goto(`${baseURL}/`);
    await expect(page.locator(".c-project", { hasText: "프리페치 회귀" })).toBeVisible();

    // 재방문자는 목록이 먼저이고 생성 폼은 접혀 있어, 프로젝트가 많아도 폼을 지나치지 않는다.
    await expect(page.locator(".c-new-project")).not.toHaveAttribute("open", "");
    const returningListBox = await page.locator(".c-project-section").boundingBox();
    const returningCreateBox = await page.locator(".c-new-project-section").boundingBox();
    expect(returningListBox!.y, "재방문에서는 프로젝트 목록이 먼저").toBeLessThan(
      returningCreateBox!.y,
    );

    /*
      **hydration이 끝난 뒤에 단언한다** (PR #84 CodeRabbit 지적). 서버 렌더된 `.c-project`는
      hydration 전에도 보이므로, 요소가 나타나자마자 검사하면 누군가 초기 `useEffect` 조회를
      되살렸을 때 그 요청이 아직 나가지 않아 **회귀를 놓친다.**

      탭 클릭이 반응한다는 것이 hydration 완료의 증거다(이벤트 핸들러가 붙었다). 단,
      재방문 생성 패널은 접혀 있으므로 summary를 먼저 열어야 내부 탭이 actionable하다
      (PR #88 Codex P2). 그 뒤 `networkidle`까지 기다려 지연된 요청도 걸리게 한다.
    */
    await page.locator(".c-new-project-summary").click();
    await expect(page.locator(".c-new-project")).toHaveAttribute("open", "");
    await page.getByRole("tab", { name: "내 화면에서 편집 (확장)" }).click();
    await expect(page.getByText("1 · 확장 설치")).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(listCalls, "첫 화면은 목록을 다시 부르지 않는다 — 서버가 이미 보냈다").toEqual([]);

    /*
      ③ **갱신 경로는 살아 있어야 한다.** 프리페치를 넣으면서 `loadProjects()`까지 걷어내면
      업로드·삭제 후 화면이 낡은 채로 남는다 — 그래서 라우트와 호출부를 둘 다 남겼고,
      여기서 그 계약을 고정한다.
    */
    page.once("dialog", (d) => void d.accept());
    await page
      .locator(".c-project", { hasText: "프리페치 회귀" })
      .getByRole("button", { name: "삭제" })
      .click();
    await expect(page.locator(".c-project", { hasText: "프리페치 회귀" })).toHaveCount(0);
    await expect(page.locator(".c-new-project")).toHaveAttribute("open", "");
    const emptyCreateBox = await page.locator(".c-new-project-section").boundingBox();
    const emptyListBox = await page.locator(".c-project-section").boundingBox();
    expect(emptyCreateBox!.y, "마지막 삭제 직후 새 프로젝트가 먼저").toBeLessThan(emptyListBox!.y);
    await expect(page.locator("main.c-console-home > section").first()).toHaveClass(
      /c-new-project-section/,
    );
    expect(listCalls.length, "삭제 뒤에는 목록을 다시 부른다").toBeGreaterThan(0);
  });

  test("경로 D 콘솔 — 생성·연결 코드·토큰 재발급 (#42)", async ({ browser, baseURL }) => {
    const user = await createUser(admin, "d");
    created.userIds.push(user.id);

    // 연결 코드는 클립보드로 나간다 — 읽기 권한이 있어야 코드 내용을 검증할 수 있다.
    const context = await browser.newContext({
      permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await signIn(admin, context, user.email, baseURL!);

    // 경로 D 폼은 두 번째 탭 안에 있다 (#51 — 기본 탭은 ZIP 업로드).
    await page.getByRole("tab", { name: "내 화면에서 편집 (확장)" }).click();
    await expect(page.getByText("1 · 확장 설치")).toBeVisible();
    await expect(page.getByText("2 · 프로젝트 연결")).toBeVisible();

    // #43 — 프로젝트 토큰을 만들기 전에 사이트에서 설치 파일을 받을 수 있어야 한다.
    const extensionDownloadLink = page.getByRole("link", { name: "확장 ZIP 다운로드" });
    await expect(extensionDownloadLink).toHaveAttribute(
      "href",
      "/download/mockspec-extension.zip",
    );
    const extensionDownloadPromise = page.waitForEvent("download");
    await extensionDownloadLink.click();
    const extensionDownload = await extensionDownloadPromise;
    expect(extensionDownload.suggestedFilename()).toBe("mockspec-extension.zip");

    // 파일명은 `<a download>` 속성에서 나오므로 산출물이 비었거나 오류 HTML이어도 통과한다.
    // 실제 바이트를 열어 설치 가능한 ZIP인지까지 봐야 깨진 배포를 잡는다.
    expect(await extensionDownload.failure(), "다운로드 실패").toBeNull();
    const downloadedZip = await JSZip.loadAsync(
      await fs.readFile(await extensionDownload.path()),
    );
    const zipEntries = Object.keys(downloadedZip.files).sort();
    expect(zipEntries, "ZIP 내부 = 단일 루트 폴더 + 필수 파일 전부").toEqual(
      EXPECTED_EXTENSION_ENTRIES,
    );

    // 화면에 표시한 버전과 실제 배포본이 어긋나면 사용자는 갱신 여부를 판단할 수 없다.
    const downloadedManifest = JSON.parse(
      await downloadedZip.file(`${EXTENSION_ARCHIVE_ROOT}/manifest.json`)!.async("string"),
    );
    await expect(page.getByText(`MockSpec v${downloadedManifest.version}`)).toBeVisible();

    await page.locator("#snippet-name").fill("경로 D 회귀");
    await page.locator("#snippet-owner").fill("QA");
    await page.getByRole("button", { name: "만들고 연결 코드 복사" }).click();
    await expect(page.getByText(/연결 코드를 복사했습니다/)).toBeVisible();

    // 연결 코드 = mockspec: + base64url(JSON{p,t,s}) — 확장이 파싱하는 그 형식이어야 한다.
    const code = await page.evaluate(() => navigator.clipboard.readText());
    expect(code, "연결 코드 접두").toMatch(/^mockspec:/);
    const decoded = decodeConnection(code);
    expect(decoded, "연결 코드 파싱").not.toBeNull();
    expect(decoded!.projectId).toMatch(/^prj_/);
    expect(decoded!.token).toMatch(/^tok_/);
    expect(decoded!.serverUrl, "서버 주소는 접속 오리진").toBe(baseURL);
    const projectId = decoded!.projectId;
    created.projectIds.push(projectId);

    // 목록에서 경로 A와 구분되고, 목업이 없으므로 "편집 열기"를 주지 않는다.
    const row = page.locator(".c-project", { hasText: "경로 D 회귀" });
    await expect(row.locator(".c-badge")).toHaveText("확장 — 내 화면에서 편집");
    await expect(row.getByRole("link", { name: "편집 열기" })).toHaveCount(0);

    // 토큰 검증은 **세션 쿠키가 없는** 컨텍스트로 한다. context.request를 쓰면 로그인 쿠키가
    // 함께 나가고 snippet GET은 세션도 허용하므로, Bearer가 틀려도 200이 나와 검증이 무의미해진다.
    const api = await request.newContext();
    const noAuth = await api.get(`${baseURL}/api/projects/${projectId}`);
    expect(noAuth.status(), "인증 없이 거부").toBe(401);
    const withToken = await api.get(`${baseURL}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${decoded!.token}` },
    });
    expect(withToken.status(), "유효 토큰 GET").toBe(200);

    // 재발급하면 이전 토큰은 즉시 무효 — 확장을 새 코드로 다시 연결해야 한다.
    //
    // 회귀 고정 (#51/PR #53): 목록은 탭 밖에 있으므로 **기본 ZIP 탭으로 돌아간 상태에서**
    // 누른다. 목록 액션의 피드백을 탭 패널 안에 그리면 숨은 패널(display:none)에 들어가
    // 버튼이 아무 반응 없어 보였다.
    //
    // 단, 위에서 프로젝트를 만들며 수가 0→1이 됐으므로 생성 패널은 **자동으로 접혔다**
    // (#85/PR #88 — `loadProjects()`의 0↔1 경계 동기화). 접힌 `<details>` 안의 탭은
    // 끝내 actionable해지지 않아 클릭이 테스트 타임아웃까지 대기한다(#91). summary를 먼저
    // 연다 — 767행과 같은 처리다. 여는 것이 이 회귀 고정을 약화시키지 않는다: 패널이 닫혀
    // 있으면 탭 패널 전체가 숨어 단언이 무의미해지고, 열어야 "ZIP 탭이 선택돼 경로 D 패널만
    // display:none"인 실제 회귀 상황이 만들어진다.
    await expect(
      page.locator(".c-new-project"),
      "첫 생성 뒤 생성 패널은 접힌다 (#85)",
    ).not.toHaveAttribute("open", "");
    await page.locator(".c-new-project-summary").click();
    await expect(page.locator(".c-new-project")).toHaveAttribute("open", "");
    await page.getByRole("tab", { name: "ZIP 업로드" }).click();
    await expect(page.getByRole("tab", { name: "ZIP 업로드" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "토큰 재발급" }).click();
    await expect(page.getByText(/토큰을 재발급하고 새 연결 코드를 복사했습니다/)).toBeVisible();

    const newCode = await page.evaluate(() => navigator.clipboard.readText());
    expect(newCode, "재발급 코드는 이전과 다르다").not.toBe(code);
    const newToken = decodeConnection(newCode)!.token;

    const oldTokenRes = await api.get(`${baseURL}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${decoded!.token}` },
    });
    expect(oldTokenRes.status(), "구 토큰 거부").toBe(401);
    const newTokenRes = await api.get(`${baseURL}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    expect(newTokenRes.status(), "새 토큰 통과").toBe(200);

    // 이슈 #63 — 겹친 재발급은 DB를 깨뜨리지 않지만(행 1개, #47) 두 요청 모두 각자의 평문
    // 토큰을 돌려주고 유효한 것은 마지막 DB writer의 하나뿐이다. 응답 도착 순서는 커밋 순서와
    // 다를 수 있으므로 콘솔이 이미 무효인 코드를 건넨다. 응답을 붙잡아 "진행 중" 상태를
    // 관찰 가능하게 만든 뒤, 그 사이 버튼이 잠기고 두 번째 요청이 나가지 않음을 고정한다.
    let tokenPosts = 0;
    let releaseReissue: () => void = () => {};
    const heldReissue = new Promise<void>((resolve) => {
      releaseReissue = resolve;
    });
    await page.route(`**/api/projects/${projectId}/token`, async (route) => {
      if (route.request().method() === "POST") {
        tokenPosts += 1;
        await heldReissue;
      }
      await route.continue();
    });

    // 진행 중에는 라벨이 "재발급 중…"으로 바뀌므로 두 상태를 모두 받는 이름으로 잡는다.
    const reissueBtn = row.getByRole("button", { name: /토큰 재발급|재발급 중/ });
    // `once`가 아니라 `on` — 두 번째 클릭의 confirm도 수락해야 한다. 그러지 않으면 Playwright가
    // 대화상자를 자동 dismiss해 confirm이 가드 노릇을 하고, 잠금을 지워도 테스트가 통과한다.
    const acceptDialog = (d: Dialog) => void d.accept();
    page.on("dialog", acceptDialog);
    await reissueBtn.click();
    await expect(reissueBtn).toBeDisabled();
    // 구 토큰의 코드를 건네지 않도록 같은 행의 복사 버튼도 함께 잠긴다.
    await expect(row.getByRole("button", { name: "연결 코드 복사" })).toBeDisabled();

    // 잠긴 버튼을 실제로 한 번 더 누른다 — disabled면 브라우저가 click을 발화하지 않으므로
    // 두 번째 요청 자체가 만들어지지 않는다(단정이 "클릭이 1회였다"로 퇴화하지 않게).
    await reissueBtn.click({ force: true });

    releaseReissue();
    await expect(reissueBtn).toBeEnabled();
    expect(tokenPosts, "잠금 중에는 재발급 요청이 한 번만 나간다").toBe(1);
    page.off("dialog", acceptDialog);
    await page.unroute(`**/api/projects/${projectId}/token`);

    await api.dispose();
    await context.close();
  });
});
