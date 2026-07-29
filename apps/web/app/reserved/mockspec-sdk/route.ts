import { SDK_BUNDLE } from "@/lib/sdk-bundle.js";

/**
 * W4b — SDK 번들 내부 핸들러.
 * 공개 URL `/__mockspec/sdk.js`는 next.config rewrite로 연결한다.
 * (`app/__mockspec`은 Next가 `_` 접두로 라우트 제외하므로 `reserved/` 아래에 둔다.)
 *
 * 번들은 빌드 시점 인라인본이다 — 런타임 경로 해석·플레이스홀더 폴백 없음(lib/sdk-bundle.ts).
 */
export function GET() {
  return new Response(SDK_BUNDLE, {
    status: 200,
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
