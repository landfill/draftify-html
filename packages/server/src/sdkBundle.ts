import { createRequire } from "node:module";
import fs from "node:fs/promises";

/**
 * /__mockspec/sdk.js 로 서빙할 SDK 번들을 읽는다.
 * 우선순위: env override → 빌드된 @mockspec/sdk/dist/sdk.js → 플레이스홀더.
 * 폴백을 두는 이유: SDK를 아직 빌드하지 않은 상태(예: 서버 단독 테스트)에서도
 * 라우트가 200으로 동작해야 한다.
 */
const require = createRequire(import.meta.url);

const PLACEHOLDER =
  `/* mockspec SDK 미빌드 — 'npm run build' 후 실제 번들이 서빙됩니다. */\n` +
  `console.warn("[mockspec] SDK 번들이 아직 빌드되지 않았습니다.");\n`;

function candidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.MOCKSPEC_SDK_BUNDLE) paths.push(process.env.MOCKSPEC_SDK_BUNDLE);
  try {
    paths.push(require.resolve("@mockspec/sdk/dist/sdk.js"));
  } catch {
    // exports 미해석(미빌드 등) — 폴백으로 진행
  }
  return paths;
}

export async function readSdkBundle(): Promise<{ body: string; built: boolean }> {
  for (const p of candidatePaths()) {
    try {
      return { body: await fs.readFile(p, "utf8"), built: true };
    } catch {
      // 다음 후보
    }
  }
  return { body: PLACEHOLDER, built: false };
}
