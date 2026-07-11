// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { encodeConnection, decodeConnection } from "./connection.js";

/**
 * [S2.5] 연결 코드 왕복 — 콘솔이 만든 코드를 확장 팝업이 그대로 해독한다 (한 번 복사→붙여넣기).
 * btoa/atob·TextEncoder는 happy-dom 환경에서 제공된다.
 */

describe("연결 코드 codec", () => {
  const info = { projectId: "prj_abc123", token: "tok_S3cr3t-_value", serverUrl: "http://localhost:4000" };

  it("encode→decode 왕복 무손실", () => {
    const code = encodeConnection(info);
    expect(code.startsWith("mockspec:")).toBe(true);
    expect(decodeConnection(code)).toEqual(info);
  });

  it("앞뒤 공백이 있어도 해독된다 (붙여넣기 여유)", () => {
    expect(decodeConnection(`  ${encodeConnection(info)}\n`)).toEqual(info);
  });

  it("콘솔의 인라인 인코딩(btoa+url-safe)과 형식이 일치한다 — 콘솔 코드가 팝업에서 해독됨", () => {
    // console.ts의 encodeConnection이 만드는 것과 동일한 방식으로 손수 만든 코드
    const json = JSON.stringify({ p: info.projectId, t: info.token, s: info.serverUrl });
    const consoleStyle = "mockspec:" + btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeConnection(consoleStyle)).toEqual(info);
    expect(consoleStyle).toBe(encodeConnection(info)); // ASCII라 shared와 바이트 동일
  });

  it("형식 오류·필드 누락·잘못된 접두는 null", () => {
    expect(decodeConnection("prj_abc123")).toBeNull(); // 프로젝트 ID를 그대로 넣은 실수
    expect(decodeConnection("mockspec:!!!notbase64")).toBeNull();
    expect(decodeConnection("mockspec:" + btoa(JSON.stringify({ p: "x", t: "tok_y", s: "z" })))).toBeNull(); // prj_ 아님
    expect(decodeConnection("mockspec:" + btoa(JSON.stringify({ p: "prj_x", s: "z" })))).toBeNull(); // 토큰 누락
    expect(decodeConnection("")).toBeNull();
  });
});
