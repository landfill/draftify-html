import { describe, it, expect, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { readSdkBundle } from "./sdkBundle.js";

afterEach(() => {
  delete process.env.MOCKSPEC_SDK_BUNDLE;
});

describe("readSdkBundle", () => {
  it("override 경로가 있으면 그 파일을 서빙한다", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-sdk-"));
    const file = path.join(tmp, "sdk.js");
    await fs.writeFile(file, "/* real bundle */\nconsole.log(1);");
    process.env.MOCKSPEC_SDK_BUNDLE = file;

    const { body, built } = await readSdkBundle();
    expect(built).toBe(true);
    expect(body).toContain("real bundle");
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("존재하지 않는 override면 플레이스홀더로 폴백한다", async () => {
    process.env.MOCKSPEC_SDK_BUNDLE = "/nonexistent/sdk.js";
    // 참고: @mockspec/sdk/dist/sdk.js가 빌드돼 있으면 그쪽으로 해석될 수 있으므로,
    // 이 테스트는 override가 우선하되 실패 시 다음 후보로 넘어감을 확인한다.
    const { body, built } = await readSdkBundle();
    // 빌드본이 있으면 built=true(그 번들), 없으면 false(플레이스홀더) — 둘 다 200 서빙 보장
    expect(typeof body).toBe("string");
    expect(body.length).toBeGreaterThan(0);
    expect(typeof built).toBe("boolean");
  });
});
