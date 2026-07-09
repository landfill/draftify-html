import fs from "node:fs/promises";
import path from "node:path";

/** 매 실행을 빈 저장소에서 시작 — 이전 실행의 프로젝트가 목록·export에 섞이지 않게. */
export default async function globalSetup(): Promise<void> {
  await fs.rm(path.resolve("test-results/e2e-data"), { recursive: true, force: true });
}
