import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// 세션 없음(미인증)으로 고정 — 게이트 분기만 본다.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
  }),
}));

const { updateSession } = await import("./middleware.js");

function req(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("updateSession — 미인증 게이트", () => {
  it("세션·토큰 없는 API는 401 JSON", async () => {
    const res = await updateSession(req("/api/projects"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." },
    });
  });

  it("Bearer 토큰이 있으면 API를 통과시킨다 — 경로 D 저장이 /login으로 삼켜지면 안 된다", async () => {
    const res = await updateSession(
      req("/api/projects/prj_x", { authorization: "Bearer tok_abc" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("예약 경로 브리지(/__mockspec/api/*)도 같은 규칙", async () => {
    expect((await updateSession(req("/__mockspec/api/projects/prj_x"))).status).toBe(401);
    const withToken = await updateSession(
      req("/__mockspec/api/projects/prj_x", { authorization: "Bearer tok_abc" }),
    );
    expect(withToken.status).toBe(200);
  });

  it("미인증 보호 페이지는 /login으로 리다이렉트", async () => {
    const res = await updateSession(req("/m/prj_x/"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("공개 페이지는 통과", async () => {
    for (const path of ["/", "/login", "/guide", "/faq", "/sample"]) {
      expect((await updateSession(req(path))).status).toBe(200);
    }
  });

  it("Bearer가 있어도 페이지 경로는 로그인으로 보낸다 (API 전용 우회)", async () => {
    const res = await updateSession(req("/m/prj_x/", { authorization: "Bearer tok_abc" }));
    expect(res.status).toBe(307);
  });
});
