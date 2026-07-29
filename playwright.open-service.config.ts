import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * open-service(W9) E2E — 공개 서비스 DoD(킥오프 §10).
 * 기존 `playwright.config.ts`(사내판 Express, 포트 4123)와 **완전히 분리**한다: 대상 서버·인증
 * 방식·데이터 저장소가 다르다. 실행은 `npm run test:e2e:web`.
 *
 * 실 Supabase 프로젝트에 붙는다 — `apps/web/.env.local`이 없으면 스펙이 스스로 스킵한다(CI 안전).
 */

// apps/web/.env.local을 이 프로세스에도 로드(테스트가 admin 클라이언트로 사용자·정리를 수행).
const envPath = path.resolve("apps/web/.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq > 0 && process.env[trimmed.slice(0, eq)] === undefined) {
      process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  }
}

const PORT = 4300; // 사내판 E2E(4123)·dev(3000)와 충돌 회피

export default defineConfig({
  testDir: "e2e-open-service",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    cwd: "apps/web",
    url: `http://localhost:${PORT}/login`, // 공개 경로 — 미인증에도 200
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
