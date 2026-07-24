import { describe, expect, it } from "vitest";
import type { SpecProject } from "@mockspec/shared";
import { applySnippetPutOverrides } from "./snippet-put-overrides.js";

const snippetBase: SpecProject = {
  version: 1,
  id: "prj_test",
  name: "테스트",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  mockupSource: { type: "snippet", registeredAt: "2026-01-01T00:00:00.000Z" },
  sceneCodeSeq: 1,
  scenes: [],
  annotations: [],
};

describe("applySnippetPutOverrides", () => {
  it("X-Mockspec-Page-Origin으로 lastSeenOrigin 스탬프", () => {
    const body = { ...snippetBase, name: "저장" };
    const req = new Request("http://x", {
      headers: { "X-Mockspec-Page-Origin": "https://admin.example" },
    });
    const out = applySnippetPutOverrides(snippetBase, body, req);
    expect(out.mockupSource).toEqual({
      type: "snippet",
      registeredAt: "2026-01-01T00:00:00.000Z",
      lastSeenOrigin: "https://admin.example",
    });
  });

  it("헤더 없으면 lastSeenOrigin 유지", () => {
    const prev: SpecProject = {
      ...snippetBase,
      mockupSource: {
        type: "snippet",
        registeredAt: "2026-01-01T00:00:00.000Z",
        lastSeenOrigin: "https://keep.me",
      },
    };
    const body = { ...prev, name: "다시" };
    const out = applySnippetPutOverrides(prev, body, new Request("http://x"));
    expect(out.mockupSource).toEqual(prev.mockupSource);
  });

  it("upload 프로젝트는 본문 그대로", () => {
    const upload: SpecProject = {
      ...snippetBase,
      mockupSource: { type: "upload", originalFilename: "m.zip", uploadedAt: "2026-01-01T00:00:00.000Z" },
    };
    const body = { ...upload, name: "zip" };
    expect(applySnippetPutOverrides(upload, body, new Request("http://x"))).toBe(body);
  });
});
