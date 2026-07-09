import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * E2E = S1 Definition of Done (technical-spec §9.1).
 * `npm run test:e2e`가 빌드·fixtures zip 생성 후 이 설정으로 실행한다.
 */

const PORT = 4123; // 개발 서버(4000)와 충돌 회피
const DATA_DIR = path.resolve("test-results/e2e-data");

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node packages/server/dist/index.js",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      MOCKSPEC_DATA_DIR: DATA_DIR,
    },
  },
});
