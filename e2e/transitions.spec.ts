import fs from "node:fs/promises";
import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * 전이·흐름도 시나리오 (T28 — FR-EDT-10·FR-EXP-06, technical-spec §9.2).
 *
 * 1. 경로 D(snippet) API로 프로젝트 생성 — 서버가 아무것도 fetch하지 않는 등록 경로
 * 2. 스냅샷 2개 업로드(토큰) + 장면 2개·어노테이션·전이(조건 포함)를 PUT으로 저장
 * 3. export(토큰) → 산출물을 새 컨텍스트에서 file://로 오픈
 * 4. 검증: 프로세스 흐름도(자체 SVG — 노드 2·간선 라벨) / 전이 링크 클릭 시 장면 전환 /
 *    흐름도 노드 클릭 시 장면 전환 / 네트워크 요청 0건
 *
 * SDK 편집 폼의 전이 지정 UI는 vitest(App.test)가 커버한다 — 이 spec은 산출물 계약 검증.
 */

const SNAP1 = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>로그인</title></head>
<body><h1>로그인</h1><button id="go">다음으로</button></body></html>`;
const SNAP2 = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>완료</title></head>
<body><h1 id="done-title">완료</h1></body></html>`;

async function uploadSnapshot(
  request: APIRequestContext,
  projectId: string,
  token: string,
  html: string,
): Promise<string> {
  const res = await request.post(`/api/projects/${projectId}/assets`, {
    headers: { authorization: `Bearer ${token}` },
    multipart: {
      snapshot: { name: "snapshot.html", mimeType: "text/html", buffer: Buffer.from(html, "utf8") },
    },
  });
  expect(res.status(), "스냅샷 업로드").toBe(201);
  return ((await res.json()) as { assetKey: string }).assetKey;
}

test("전이·흐름도: 전이 지정 spec → export → file://에서 흐름도·전이 링크 동작 + 네트워크 0건", async ({ request, browser }, testInfo) => {
  // ── 1. 프로젝트 생성 (경로 D — 토큰 응답) ─────────────────────────
  const created = await request.post("/api/projects", { data: { name: "전이 흐름도", source: "snippet" } });
  expect(created.status()).toBe(201);
  const { project, token } = (await created.json()) as {
    project: { id: string; createdAt: string };
    token: string;
  };

  // ── 2. 스냅샷 업로드 + 장면 2·전이 1(조건) PUT ────────────────────
  const asset1 = await uploadSnapshot(request, project.id, token, SNAP1);
  const asset2 = await uploadSnapshot(request, project.id, token, SNAP2);

  const now = new Date().toISOString();
  const spec = {
    version: 1,
    id: project.id,
    name: "전이 흐름도",
    createdAt: project.createdAt,
    updatedAt: now,
    mockupSource: { type: "snippet", registeredAt: project.createdAt },
    sceneCodeSeq: 3,
    scenes: [
      // captureWidth/Height: 동결 시점 뷰포트 크기 — 뷰어가 이 크기로 렌더 (반응형·100vh류 캡처 재현)
      { id: "scn_login00001", code: "SCR-001", title: "로그인", route: "/", order: 0, annoNumberSeq: 2, snapshotAsset: asset1, frozenAt: now, captureWidth: 1280, captureHeight: 800 },
      // 구 스냅샷 호환: captureWidth/Height 없음 → 뷰어가 중앙 가용 폭·최소 높이로 폴백 (300px 붕괴 금지)
      { id: "scn_done000001", code: "SCR-002", title: "완료", route: "/done", order: 1, annoNumberSeq: 2, snapshotAsset: asset2, frozenAt: now },
    ],
    annotations: [
      {
        id: "ann_go00000001",
        sceneId: "scn_login00001",
        number: 1,
        anchor: { selector: "#go", text: "다음으로", rect: { x: 0.1, y: 0.3, w: 0.1, h: 0.05 } },
        title: "다음 버튼",
        description: "클릭하면 완료 화면으로 이동한다.",
        transition: { toSceneId: "scn_done000001", condition: "성공 시" },
      },
      {
        id: "ann_done000001",
        sceneId: "scn_done000001",
        number: 1,
        anchor: { selector: "#done-title", text: "완료", rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.05 } },
        title: "완료 안내",
        description: "전이 없는 어노테이션 — 링크가 없어야 한다.",
      },
    ],
  };
  const saved = await request.put(`/api/projects/${project.id}`, {
    headers: { authorization: `Bearer ${token}` },
    data: spec,
  });
  expect(saved.status(), "spec 저장").toBe(200);

  // ── 3. export → 산출물 저장 ──────────────────────────────────────
  const exported = await request.post(`/api/projects/${project.id}/export`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(exported.status(), "export").toBe(200);
  const exportPath = testInfo.outputPath("transitions-export.html");
  await fs.writeFile(exportPath, await exported.body());

  // ── 4. 새 컨텍스트 file:// 오픈 + 흐름도·전이 링크·오프라인 검증 ──
  const offline = await browser.newContext();
  const viewer = await offline.newPage();
  const requests: string[] = [];
  viewer.on("request", (req) => requests.push(req.url()));

  await viewer.goto(`file://${exportPath}`);

  // 섹션 2: 프로세스 흐름도 — 장면 노드 2 + 간선 라벨(조건)
  const flow = viewer.locator(".ms-flow");
  await expect(flow).toBeVisible();
  await expect(flow.locator(".ms-flow-node")).toHaveCount(2);
  await expect(flow.locator(".ms-flow-node").first()).toContainText("SCR-001 로그인");
  await expect(flow.locator(".ms-flow-label")).toHaveText("성공 시");

  // 전이 링크: 장면 1의 어노테이션에만 존재, 형식 = "조건 → SCR-### 제목 보기"
  const link = viewer.locator(".ms-transition");
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText("성공 시 → SCR-002 완료 보기");

  // 스냅샷 iframe이 동결 시점 크기(captureWidth/Height)로 렌더된다 — 반응형·100vh류 캡처 재현
  await expect
    .poll(() => viewer.locator(".ms-frame").evaluate((el) => el.clientWidth), { message: "장면 1 iframe = captureWidth" })
    .toBe(1280);
  await expect
    .poll(() => viewer.locator(".ms-frame").evaluate((el) => el.clientHeight), { message: "장면 1 iframe = captureHeight" })
    .toBe(800);

  // 링크 클릭 → 장면 2로 전환(실행 대신 이동) + 흐름도 하이라이트 동기화
  await link.click();
  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-002");
  await expect(viewer.locator(".ms-flow-node.is-active")).toHaveAttribute("data-scene-id", "scn_done000001");
  await expect(viewer.locator(".ms-transition")).toHaveCount(0); // 장면 2엔 전이 없음

  // captureWidth 없는 구 스냅샷은 중앙 가용 폭으로 폴백 — 기본 300px 붕괴(모바일 오인) 금지
  await expect
    .poll(() => viewer.locator(".ms-frame").evaluate((el) => el.clientWidth), { message: "장면 2 iframe 폴백 폭" })
    .toBeGreaterThan(500);

  // 흐름도 노드 클릭 → 장면 1로 복귀
  await viewer.locator('.ms-flow-node[data-scene-id="scn_login00001"]').click();
  await expect(viewer.locator(".ms-stage-title")).toContainText("SCR-001");

  // 네트워크 요청 0건: 문서 자체(file://) 1건뿐
  const external = requests.filter((u) => !u.startsWith("file://"));
  expect(external, "외부(비 file://) 요청").toEqual([]);
  expect(requests, "file:// 요청은 문서 1건뿐").toHaveLength(1);

  await offline.close();

  // 공유 서버 잔재 제거 — 다른 spec의 콘솔 목록 가정을 오염시키지 않는다
  await request.delete(`/api/projects/${project.id}`);
});
