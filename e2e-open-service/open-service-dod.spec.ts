import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decodeConnection } from "@mockspec/shared";
import {
  test,
  expect,
  request,
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

  /**
   * 이슈 #46 — 크로스 디바이스 로그인. 다른 기기에서 링크를 열면 PKCE code_verifier가 없어
   * `/auth/callback`은 실패한다. 그래서 메일 링크는 `/auth/confirm?token_hash=…&type=…`로
   * 가야 하고, 그 형태는 Supabase **이메일 템플릿 설정**으로만 바뀐다(코드 아님).
   *
   * 여기서 고정하는 것: `/auth/confirm`이 **`type=signup`과 `type=magiclink` 둘 다** 처리하는가.
   * `signInWithOtp`는 `shouldCreateUser` 기본값이 true라 **신규 가입자는 `Confirm sign up`
   * 템플릿**을, 기존 사용자는 `Magic link` 템플릿을 받는다 — 두 type이 모두 성립해야
   * 공개 서비스의 가입 퍼널이 크로스 디바이스에서 끊기지 않는다.
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
    }

    // 로그아웃 상태에서는 반대로 나와야 한다 — 정적 페이지도 포함.
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    for (const path of ["/guide", "/faq"]) {
      await anonPage.goto(`${baseURL}${path}`);
      await expect(
        anonPage.getByRole("link", { name: "로그인" }),
        `${path} 비로그인 헤더에 로그인 링크`,
      ).toBeVisible();
      await expect(
        anonPage.getByRole("button", { name: "로그아웃" }),
        `${path} 비로그인 헤더에 로그아웃 없음`,
      ).toHaveCount(0);
    }

    await anon.close();
    await context.close();
  });

  /**
   * 이슈 #42 — 경로 D(확장) 진입점. W6에서 백엔드(snippet 생성·토큰·Bearer)를 이식했는데
   * W7 콘솔 이식에서 UI가 빠져 **공개판에서 경로 D 프로젝트를 만들 수단이 없었다.**
   * 위 DoD가 경로 A 시나리오만 봐서 놓친 갭이라, 진입점 자체를 여기서 회귀 고정한다.
   */
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
    await page.getByRole("tab", { name: "ZIP 업로드" }).click();
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

    await api.dispose();
    await context.close();
  });
});
