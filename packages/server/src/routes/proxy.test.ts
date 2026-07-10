import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import type { SpecProject } from "@mockspec/shared";
import { buildApp } from "../app.js";
import { specFile, projectDir } from "../store/paths.js";
import { ALLOWLIST_ENV, ALLOW_LOOPBACK_ENV } from "../proxy/ssrfGuard.js";

/**
 * T13 프록시 코어 통합 테스트. 실제 업스트림 http 서버(127.0.0.1)를 띄우고, proxy 타입
 * 프로젝트를 통해 서브도메인 Host로 프록시 왕복을 검증한다. 루프백은 dev/test 스위치로 허용.
 */

const app = buildApp();
const PROJECT_ID = "prj_proxytest1";
const HOST = `${PROJECT_ID}.localhost:4000`;

let upstream: http.Server;
let upstreamPort: number;
let origin: string;
let originHost: string;

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/api/data") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, secret: "json-passthrough" }));
      return;
    }
    if (url === "/goto") {
      res.writeHead(302, { location: `${origin}/dest` }); // 오리진 내부 리다이렉트
      res.end();
      return;
    }
    if (url === "/out") {
      res.writeHead(302, { location: "https://evil.example.com/phish" }); // 오리진 밖
      res.end();
      return;
    }
    if (url === "/cookie") {
      res.writeHead(200, {
        "content-type": "text/plain",
        "set-cookie": [
          "auth=123; Domain=example.com; Path=/; Secure; HttpOnly",
          "other=abc; domain=.example.com; Secure",
        ],
      });
      res.end("cookie set");
      return;
    }
    // 기본: HTML (CSP·XFO 헤더 포함, 절대 URL 포함, </body> 있음)
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": "default-src 'self'",
      "x-frame-options": "DENY",
    });
    res.end(
      `<!doctype html><html><body>` +
        `<h1>UPSTREAM</h1>` +
        `<script src="${origin}/app.js"></script>` +
        `</body></html>`,
    );
  });
  await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
  upstreamPort = (upstream.address() as AddressInfo).port;
  originHost = `127.0.0.1:${upstreamPort}`;
  origin = `http://${originHost}`;
});

afterAll(async () => {
  await new Promise<void>((r) => upstream.close(() => r()));
});

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-proxy-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
  process.env[ALLOWLIST_ENV] = "127.0.0.1";
  process.env[ALLOW_LOOPBACK_ENV] = "1";
  // proxy 타입 프로젝트 spec.json을 직접 작성 (URL 등록 라우트는 T15)
  const now = "2026-07-10T00:00:00.000Z";
  const spec: SpecProject = {
    version: 1,
    id: PROJECT_ID,
    name: "프록시",
    createdAt: now,
    updatedAt: now,
    mockupSource: { type: "proxy", originUrl: origin, registeredAt: now },
    sceneCodeSeq: 1,
    scenes: [],
    annotations: [],
  };
  await fs.mkdir(projectDir(PROJECT_ID), { recursive: true });
  await fs.writeFile(specFile(PROJECT_ID), JSON.stringify(spec), "utf8");
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  delete process.env[ALLOWLIST_ENV];
  delete process.env[ALLOW_LOOPBACK_ENV];
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("프록시 코어 (T13)", () => {
  it("HTML 응답: SDK 주입 + 절대 URL 재작성 + CSP/XFO 제거", async () => {
    const res = await request(app).get("/").set("Host", HOST);
    expect(res.status).toBe(200);
    expect(res.text).toContain("UPSTREAM");
    // SDK 주입
    expect(res.text).toContain("/__mockspec/sdk.js");
    expect(res.text).toContain(`data-project="${PROJECT_ID}"`);
    // 절대 URL이 프로토콜 상대 프록시 URL로 재작성됨 (오리진 문자열 사라짐)
    expect(res.text).not.toContain(origin);
    expect(res.text).toContain(`//${HOST}/app.js`);
    // SDK 방해 헤더 제거
    expect(res.headers["content-security-policy"]).toBeUndefined();
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("비HTML(JSON)은 가공 없이 통과", async () => {
    const res = await request(app).get("/api/data").set("Host", HOST);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.body).toEqual({ ok: true, secret: "json-passthrough" });
    expect(res.text).not.toContain("sdk.js"); // 주입 안 함
  });

  it("오리진 내부 리다이렉트: Location을 프록시 경로로 재작성", async () => {
    const res = await request(app).get("/goto").set("Host", HOST).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers["location"]).toBe("/dest"); // 오리진 제거, 프록시 유지
  });

  it("오리진 밖 리다이렉트: 502 거부", async () => {
    const res = await request(app).get("/out").set("Host", HOST).redirects(0);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("BAD_GATEWAY");
  });

  it("예약 경로 /__mockspec/sdk.js는 프록시하지 않고 로컬 SDK 번들 서빙", async () => {
    const res = await request(app).get("/__mockspec/sdk.js").set("Host", HOST);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("javascript");
    expect(res.text).not.toContain("UPSTREAM"); // 업스트림 응답 아님
  });

  it("allowlist가 좁아지면(오리진 미포함) 매 요청 재검증에서 502", async () => {
    process.env[ALLOWLIST_ENV] = "other.internal";
    const res = await request(app).get("/").set("Host", HOST);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("BAD_GATEWAY");
  });

  it("루프백 허용 스위치가 꺼지면 IP 고정 가드가 연결을 차단(502)", async () => {
    delete process.env[ALLOW_LOOPBACK_ENV];
    const res = await request(app).get("/").set("Host", HOST);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("BAD_GATEWAY");
  });

  it("Set-Cookie 재바인딩: Domain 제거 및 프록시 http 시 Secure 제거", async () => {
    const res = await request(app).get("/cookie").set("Host", HOST);
    expect(res.status).toBe(200);
    const cookies = res.headers["set-cookie"] as string[];
    expect(cookies).toBeDefined();
    expect(cookies).toHaveLength(2);
    // Domain 제거됨, HttpOnly는 유지, Secure는 http 환경이므로 제거됨
    expect(cookies[0]).toBe("auth=123; Path=/; HttpOnly");
    expect(cookies[1]).toBe("other=abc");
  });
});
