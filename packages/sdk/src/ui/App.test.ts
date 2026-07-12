// @vitest-environment happy-dom
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecProject } from "@mockspec/shared";
import { App } from "./App.js";

const project: SpecProject = {
  version: 1,
  id: "prj_app12345",
  name: "앱",
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z",
  mockupSource: {
    type: "upload",
    originalFilename: "dist.zip",
    uploadedAt: "2026-07-07T00:00:00.000Z",
  },
  sceneCodeSeq: 2,
  scenes: [
    {
      id: "scn_home",
      code: "SCR-001",
      title: "홈",
      route: "/",
      order: 0,
      annoNumberSeq: 1,
    },
  ],
  annotations: [],
};

class StubResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  // #root의 data-mockspec-root는 main.tsx의 호스트 마킹과 동일 — 패널 내부 클릭이
  // 편집 모드 부착 시퀀스(isOwn 검사)에 잡히지 않게 한다
  document.body.innerHTML = `<button id="target">저장</button><button id="other">취소</button><div id="root" data-mockspec-root></div>`;
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

afterEach(() => {
  render(null, document.getElementById("root")!);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 서버 저장을 항상 성공시키는 fetch 스텁 + 마운트·패널 열기까지 공통 수행. */
async function mountWithOpenPanel(): Promise<{ getDoc: () => SpecProject }> {
  let lastSaved: SpecProject = project;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (!init?.method || init.method === "GET") return jsonResponse(lastSaved);
    lastSaved = JSON.parse(String(init.body)) as SpecProject;
    return jsonResponse({ ...lastSaved, updatedAt: "2026-07-10T00:00:05.000Z" });
  });

  await act(async () => {
    render(h(App, { projectId: project.id }), document.getElementById("root")!);
    await flushPromises();
  });
  await act(async () => {
    document.querySelector<HTMLButtonElement>(".fab")!.click();
    await flushPromises();
  });
  return { getDoc: () => lastSaved };
}

function clickMockup(id: string, opts: MouseEventInit = {}): void {
  document.getElementById(id)!.dispatchEvent(new MouseEvent("click", {
    bubbles: true, cancelable: true, clientX: 1, clientY: 1, ...opts,
  }));
}

async function saveTick(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
    await flushPromises();
  });
}

describe("어노테이션 부착 UX (킥오프 §11 4·5차 개정)", () => {
  it("이미 어노테이션이 있는 요소 클릭은 선택 — 중복 생성하지 않는다. Shift+클릭은 추가한다", async () => {
    const { getDoc } = await mountWithOpenPanel();

    await act(async () => { clickMockup("target"); });
    await act(async () => {
      // 제목을 채워 자동 정리 대상에서 제외
      const title = document.querySelector<HTMLInputElement>("input.ann__title")!;
      title.value = "저장 버튼";
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await saveTick();
    expect(getDoc().annotations).toHaveLength(1);

    // 같은 요소 재클릭 → 생성 아님(선택)
    await act(async () => { clickMockup("target"); });
    await saveTick();
    expect(getDoc().annotations).toHaveLength(1);

    // Shift+클릭 → 같은 요소에 추가
    await act(async () => { clickMockup("target", { shiftKey: true }); });
    await act(async () => {
      const titles = document.querySelectorAll<HTMLInputElement>("input.ann__title");
      const t = titles[titles.length - 1];
      t.value = "저장 버튼 (에러 케이스)";
      t.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await saveTick();
    expect(getDoc().annotations).toHaveLength(2);
  });

  it("빈 어노테이션은 미작성 핀으로 유지된다 — 요소 먼저 찍고 나중에 작성 (5차 개정)", async () => {
    const { getDoc } = await mountWithOpenPanel();

    // 내용 입력 없이 요소 2개를 연속으로 찍는다
    await act(async () => { clickMockup("target"); });
    await act(async () => { clickMockup("other"); });
    await saveTick();

    // 둘 다 남는다 (자동 삭제 없음), 번호 1·2
    const anns = getDoc().annotations;
    expect(anns).toHaveLength(2);
    expect(anns.map((a) => a.number)).toEqual([1, 2]);

    // 미작성 구분 스타일이 마커·목록에 표시된다
    expect(document.querySelectorAll(".marker--empty")).toHaveLength(2);
    expect(document.querySelectorAll(".ann--empty")).toHaveLength(2);
  });

  it("[빈 어노테이션 정리] 버튼이 미작성 핀만 일괄 삭제한다", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    const { getDoc } = await mountWithOpenPanel();

    await act(async () => { clickMockup("target"); });
    await act(async () => { clickMockup("other"); });
    await act(async () => {
      // 첫 번째만 제목을 채운다 → 미작성은 두 번째 하나
      const title = document.querySelector<HTMLInputElement>("input.ann__title")!;
      title.value = "저장 버튼";
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const btn = [...document.querySelectorAll<HTMLButtonElement>("button.btn")]
      .find((b) => b.textContent?.includes("빈 어노테이션 정리"));
    expect(btn?.textContent).toContain("(1)");
    await act(async () => { btn!.click(); });
    await saveTick();

    const anns = getDoc().annotations;
    expect(anns).toHaveLength(1);
    expect(anns[0]?.title).toBe("저장 버튼");
    // 정리 후 버튼은 사라진다 (미작성 0개)
    expect([...document.querySelectorAll("button.btn")]
      .some((b) => b.textContent?.includes("빈 어노테이션 정리"))).toBe(false);
  });

  it("마커 드래그는 markerOffset(상대 오프셋)으로 저장된다", async () => {
    const { getDoc } = await mountWithOpenPanel();

    await act(async () => { clickMockup("target"); });
    await act(async () => {
      const title = document.querySelector<HTMLInputElement>("input.ann__title")!;
      title.value = "저장 버튼";
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // 각 이벤트를 별도 act로 — pointerdown의 드래그 effect(window 리스너 부착)가
    // 다음 이벤트 전에 flush되어야 한다
    const marker = document.querySelector<HTMLButtonElement>("button.marker")!;
    await act(async () => {
      marker.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 80 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 80 }));
    });
    await saveTick();

    expect(getDoc().annotations[0]?.markerOffset).toEqual({ dx: 30, dy: -20 });

    // 임계값(4px) 이하 이동은 드래그가 아니다 — 오프셋 불변
    await act(async () => {
      marker.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 100, clientY: 100 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 101, clientY: 101 }));
    });
    await act(async () => {
      window.dispatchEvent(new MouseEvent("pointerup", { clientX: 101, clientY: 101 }));
    });
    await saveTick();
    expect(getDoc().annotations[0]?.markerOffset).toEqual({ dx: 30, dy: -20 });
  });

  it("앞 번호 칸을 클릭(포커스)하면 선택이 그 칸을 따라간다 — 포커스가 마지막으로 튀지 않음 (실사용)", async () => {
    await mountWithOpenPanel();

    // 요소 2개 찍어 어노테이션 1·2 생성 → 마지막(2번)이 선택 상태
    await act(async () => { clickMockup("target"); });
    await act(async () => { clickMockup("other"); });

    const rows = () => [...document.querySelectorAll<HTMLElement>(".ann")];
    expect(rows()).toHaveLength(2);
    expect(rows()[1]!.classList.contains("ann--sel")).toBe(true);  // 마지막이 선택
    expect(rows()[0]!.classList.contains("ann--sel")).toBe(false);

    // 첫 번째(1번) 제목 칸을 클릭 → 선택이 1번으로 이동해야 한다
    // (focus·mousedown은 focusShield가 페이지로 못 새게 막으므로 선택 추종은 onClick으로 처리)
    await act(async () => {
      document.querySelectorAll<HTMLInputElement>("input.ann__title")[0]!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(rows()[0]!.classList.contains("ann--sel")).toBe(true);   // 선택이 1번을 따라감
    expect(rows()[1]!.classList.contains("ann--sel")).toBe(false);

    // 1번 설명 칸을 클릭하고 입력해도 선택이 1번에 유지된다 (마지막으로 튀지 않음)
    await act(async () => {
      const desc = document.querySelectorAll<HTMLTextAreaElement>("textarea.ann__desc")[0]!;
      desc.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      desc.value = "첫 번째 설명";
      desc.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await saveTick();
    expect(rows()[0]!.classList.contains("ann--sel")).toBe(true);
  });
});

describe("전이 지정 UI (T27, §3.10)", () => {
  const twoSceneProject: SpecProject = {
    ...project,
    sceneCodeSeq: 3,
    scenes: [
      ...project.scenes,
      { id: "scn_done", code: "SCR-002", title: "완료", route: "/done", order: 1, annoNumberSeq: 1 },
    ],
  };

  /** 장면 2개 프로젝트로 마운트 + 패널 열기 + 어노테이션 1개 부착까지. */
  async function mountTwoScenes(): Promise<{ getDoc: () => SpecProject }> {
    let lastSaved: SpecProject = twoSceneProject;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.method || init.method === "GET") return jsonResponse(lastSaved);
      lastSaved = JSON.parse(String(init.body)) as SpecProject;
      return jsonResponse({ ...lastSaved, updatedAt: "2026-07-12T00:00:05.000Z" });
    });
    await act(async () => {
      render(h(App, { projectId: project.id }), document.getElementById("root")!);
      await flushPromises();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>(".fab")!.click();
      await flushPromises();
    });
    await act(async () => { clickMockup("target"); });
    return { getDoc: () => lastSaved };
  }

  it("드롭다운은 다른 장면만 나열하고, 지정→조건 입력→해제가 저장에 왕복된다", async () => {
    const { getDoc } = await mountTwoScenes();

    // 자기 장면(scn_home)은 나열하지 않는다: 옵션 = "전이 없음" + SCR-002 완료
    const select = document.querySelector<HTMLSelectElement>("select.ann__trans-scene")!;
    const options = [...select.querySelectorAll("option")].map((o) => o.value);
    expect(options).toEqual(["", "scn_done"]);

    // 전이 지정 → transition 저장 (조건 없음 = 필드 자체 없음)
    await act(async () => {
      select.value = "scn_done";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await saveTick();
    expect(getDoc().annotations[0]?.transition).toEqual({ toSceneId: "scn_done" });

    // 조건 입력란이 나타나고 condition이 저장된다
    await act(async () => {
      const cond = document.querySelector<HTMLInputElement>("input.ann__trans-cond")!;
      cond.value = "성공 시";
      cond.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await saveTick();
    expect(getDoc().annotations[0]?.transition).toEqual({ toSceneId: "scn_done", condition: "성공 시" });

    // "전이 없음"으로 되돌리면 transition이 제거된다
    await act(async () => {
      const sel = document.querySelector<HTMLSelectElement>("select.ann__trans-scene")!;
      sel.value = "";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await saveTick();
    expect(getDoc().annotations[0]).not.toHaveProperty("transition");
  });

  it("다른 장면이 없으면(장면 1개) 전이 드롭다운을 노출하지 않는다", async () => {
    const { getDoc } = await mountWithOpenPanel();
    await act(async () => { clickMockup("target"); });
    await saveTick();
    expect(getDoc().annotations).toHaveLength(1);
    expect(document.querySelector("select.ann__trans-scene")).toBeNull();
  });
});

describe("장면 제목 (킥오프 §11 8차 — 기본값 자동 부여 철회)", () => {
  it("새 장면은 빈 제목으로 생성되고(document.title 미사용), 목록 인라인 입력으로 명명한다", async () => {
    document.title = "tmdb-quiz"; // SPA의 불변 <title> — 장면 제목에 자동으로 붙으면 안 된다
    const { getDoc } = await mountWithOpenPanel();

    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>("button")]
        .find((b) => b.textContent?.includes("현재 화면을 장면으로"))!.click();
    });
    await saveTick();
    expect(getDoc().scenes).toHaveLength(2);
    expect(getDoc().scenes[1]?.title).toBe(""); // document.title이 붙지 않는다

    // 목록의 인라인 입력으로 직접 명명 → 저장 반영
    await act(async () => {
      const title = document.querySelectorAll<HTMLInputElement>("input.scene__title")[1]!;
      title.value = "메인 스튜디오";
      title.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await saveTick();
    expect(getDoc().scenes[1]?.title).toBe("메인 스튜디오");
  });
});

describe("편집 화면 내보내기 (킥오프 §11 6차 개정)", () => {
  it("내보내기 버튼이 export API를 호출하고 파일명대로 다운로드를 트리거한다", async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);
    const exportCalls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/export") && init?.method === "POST") {
        exportCalls.push(url);
        return new Response("<!doctype html><html></html>", {
          status: 200,
          headers: {
            "content-type": "text/html",
            "content-disposition": `attachment; filename="mockup.html"; filename*=UTF-8''${encodeURIComponent("주문 목업.html")}`,
          },
        });
      }
      if (!init?.method || init.method === "GET") return jsonResponse(project);
      return jsonResponse({ ...JSON.parse(String(init.body)), updatedAt: "2026-07-10T00:00:05.000Z" });
    });
    // happy-dom에 없는 다운로드 경로 스텁
    vi.stubGlobal("URL", Object.assign(Object.create(URL), {
      createObjectURL: vi.fn(() => "blob:mock"),
      revokeObjectURL: vi.fn(),
    }));
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.download);
    });

    await act(async () => {
      render(h(App, { projectId: project.id }), document.getElementById("root")!);
      await flushPromises();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>(".fab")!.click();
      await flushPromises();
    });

    const btn = document.querySelector<HTMLButtonElement>("button.btn--export")!;
    expect(btn.disabled).toBe(false);
    await act(async () => {
      btn.click();
      await flushPromises();
    });

    // 스냅샷 없는 장면 1개 → 확인 다이얼로그 경유
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(confirmSpy.mock.calls[0][0]).toContain("1개 장면에 스냅샷이 없습니다");
    expect(exportCalls).toEqual([`/__mockspec/api/projects/${project.id}/export`]);
    // filename*(한글) 우선으로 다운로드 파일명 유지
    expect(clicked).toEqual(["주문 목업.html"]);
  });

  it("확인 다이얼로그에서 취소하면 export를 호출하지 않는다", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.method || init.method === "GET") return jsonResponse(project);
      return jsonResponse({ ...JSON.parse(String(init.body)), updatedAt: "2026-07-10T00:00:05.000Z" });
    });

    await act(async () => {
      render(h(App, { projectId: project.id }), document.getElementById("root")!);
      await flushPromises();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>(".fab")!.click();
      await flushPromises();
    });
    await act(async () => {
      document.querySelector<HTMLButtonElement>("button.btn--export")!.click();
      await flushPromises();
    });

    expect(fetchSpy.mock.calls.every(([u]) => !String(u).endsWith("/export"))).toBe(true);
  });
});

describe("App 저장·오프라인 큐 (T7)", () => {
  it("편집 변경 PUT 실패 후 localStorage에 보관하고 서버 복귀 시 자동 재전송한다", async () => {
    const savedBodies: SpecProject[] = [];
    let putCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.method || init.method === "GET") return jsonResponse(project);
      const body = JSON.parse(String(init.body)) as SpecProject;
      savedBodies.push(body);
      putCount += 1;
      if (putCount === 1) throw new Error("server down");
      return jsonResponse({ ...body, updatedAt: "2026-07-07T00:00:05.000Z" });
    });

    await act(async () => {
      render(h(App, { projectId: project.id }), document.getElementById("root")!);
      await flushPromises();
    });

    await act(async () => {
      document.querySelector<HTMLButtonElement>(".fab")!.click();
      await flushPromises();
    });
    await act(async () => {
      document.getElementById("target")!.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: 1,
        clientY: 1,
      }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
      await flushPromises();
    });

    expect(localStorage.getItem(`mockspec:pending:${project.id}`)).not.toBeNull();
    expect(savedBodies[0]?.annotations).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
      await flushPromises();
    });

    expect(localStorage.getItem(`mockspec:pending:${project.id}`)).toBeNull();
    expect(savedBodies).toHaveLength(2);
    expect(savedBodies[1]?.annotations).toHaveLength(1);
  });
});
