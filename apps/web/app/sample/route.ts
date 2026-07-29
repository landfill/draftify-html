import { buildSampleHtml } from "../../../../packages/server/src/routes/sample.js";
import { VIEWER_SCRIPT } from "@/lib/export/viewer-script.js";

let cachedHtml: Promise<string> | undefined;

/** GET /sample — 산출물 그 자체를 인라인으로 서빙 (Express samplePage과 동일 파이프라인). */
export async function GET() {
  if (!cachedHtml) {
    // 뷰어 런타임은 빌드 시점 인라인본을 넘긴다 — 서버리스에서 fs로 읽지 않는다.
    cachedHtml = buildSampleHtml(VIEWER_SCRIPT).catch((err: unknown) => {
      cachedHtml = undefined;
      throw err;
    });
  }
  const html = await cachedHtml;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
