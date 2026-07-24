import { readSdkBundle } from "../../../../../packages/server/src/sdkBundle.js";

/**
 * W4b — SDK 번들 내부 핸들러.
 * 공개 URL `/__mockspec/sdk.js`는 next.config rewrite로 연결한다.
 * (`app/__mockspec`은 Next가 `_` 접두로 라우트 제외하므로 `reserved/` 아래에 둔다.)
 */
export async function GET() {
  const { body } = await readSdkBundle();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
