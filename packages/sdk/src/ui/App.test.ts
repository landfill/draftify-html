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
  document.body.innerHTML = `<button id="target">저장</button><div id="root"></div>`;
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
});

afterEach(() => {
  render(null, document.getElementById("root")!);
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App 저장·오프라인 큐 (T7)", () => {
  it("편집 변경 PUT 실패 후 localStorage에 보관하고 서버 복귀 시 자동 재전송한다", async () => {
    const savedBodies: SpecProject[] = [];
    let putCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (!init?.method) return jsonResponse(project);
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
