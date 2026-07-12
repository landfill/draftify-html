// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpecProject } from "@mockspec/shared";
import {
  clearPendingProject,
  exportProjectHtml,
  flushPendingProject,
  NATIVE_DOWNLOAD_HEADER,
  readPendingProject,
  saveProjectWithQueue,
  writePendingProject,
} from "./api.js";
import { fetchTransport, setTransport, type TransportRequest } from "./transport.js";

const baseProject: SpecProject = {
  version: 1,
  id: "prj_test1234",
  name: "테스트",
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T00:00:00.000Z",
  mockupSource: {
    type: "upload",
    originalFilename: "dist.zip",
    uploadedAt: "2026-07-07T00:00:00.000Z",
  },
  sceneCodeSeq: 1,
  scenes: [],
  annotations: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Spec API 저장 큐 (T7)", () => {
  it("pending 큐는 project별 최신 SpecProject 1개만 보관한다", () => {
    writePendingProject(baseProject);
    const next: SpecProject = { ...baseProject, sceneCodeSeq: 2 };
    writePendingProject(next);

    expect(readPendingProject(baseProject.id)?.sceneCodeSeq).toBe(2);
  });

  it("저장 성공 시 PUT 응답을 반환하고 pending 큐를 비운다", async () => {
    writePendingProject(baseProject);
    const saved: SpecProject = { ...baseProject, updatedAt: "2026-07-07T00:00:01.000Z" };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(saved));

    const result = await saveProjectWithQueue(baseProject);

    expect(result.queued).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith("/__mockspec/api/projects/prj_test1234", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(baseProject),
    });
    expect(readPendingProject(baseProject.id)).toBeNull();
  });

  it("저장 실패 시 같은 key에 최신본을 적재한다", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("server down"));
    const next: SpecProject = { ...baseProject, sceneCodeSeq: 3 };

    const result = await saveProjectWithQueue(next);

    expect(result.queued).toBe(true);
    expect(readPendingProject(baseProject.id)?.sceneCodeSeq).toBe(3);
  });

  it("pending 재전송 성공 시 큐를 삭제한다", async () => {
    writePendingProject(baseProject);
    const saved: SpecProject = { ...baseProject, updatedAt: "2026-07-07T00:00:02.000Z" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(saved));

    await expect(flushPendingProject(baseProject.id)).resolves.toEqual(saved);
    expect(readPendingProject(baseProject.id)).toBeNull();
  });

  it("깨진 pending 값은 폐기한다", () => {
    localStorage.setItem("mockspec:pending:prj_test1234", "{not json");

    expect(readPendingProject(baseProject.id)).toBeNull();
    expect(localStorage.getItem("mockspec:pending:prj_test1234")).toBeNull();
  });

  it("pending이 없으면 재전송은 null", async () => {
    await expect(flushPendingProject(baseProject.id)).resolves.toBeNull();
  });

  it("clearPendingProject는 해당 project 큐만 지운다", () => {
    writePendingProject(baseProject);
    writePendingProject({ ...baseProject, id: "prj_other999" });

    clearPendingProject(baseProject.id);

    expect(readPendingProject(baseProject.id)).toBeNull();
    expect(readPendingProject("prj_other999")).not.toBeNull();
  });
});

describe("내보내기 transport (실사용 13차 — 경로 D 확장 메시지 64MiB 리밋)", () => {
  afterEach(() => setTransport(fetchTransport));

  it("export 요청에 download 표시가 실리고, 브리지 native-download 마커면 본문 없이 완료로 처리한다", async () => {
    let seen: TransportRequest | null = null;
    setTransport(async (req) => {
      seen = req;
      // background가 chrome.downloads로 직접 저장했음을 알리는 합성 응답 — 본문은 작다
      return { ok: true, status: 200, headers: { [NATIVE_DOWNLOAD_HEADER]: "1" }, bodyText: '{"downloadId":7}' };
    });

    const result = await exportProjectHtml(baseProject.id);

    expect(seen!.download).toBe(true);
    expect(seen!.path).toBe(`/projects/${baseProject.id}/export`);
    expect(result.nativeDownload).toBe(true);
  });

  it("마커가 없으면(경로 A·B) 기존 blob 다운로드 흐름 그대로다", async () => {
    setTransport(async () => ({
      ok: true,
      status: 200,
      headers: { "content-disposition": 'attachment; filename="plan.html"' },
      bodyText: "<!doctype html><title>산출물</title>",
    }));

    const result = await exportProjectHtml(baseProject.id);

    expect(result.nativeDownload).toBe(false);
    if (!result.nativeDownload) {
      expect(result.filename).toBe("plan.html");
      expect(await result.blob.text()).toContain("산출물");
    }
  });
});
