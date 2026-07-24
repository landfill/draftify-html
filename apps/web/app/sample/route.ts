import { buildSampleHtml } from "../../../../packages/server/src/routes/sample.js";

let cachedHtml: Promise<string> | undefined;

/** GET /sample — 산출물 그 자체를 인라인으로 서빙 (Express samplePage과 동일 파이프라인). */
export async function GET() {
  if (!cachedHtml) {
    cachedHtml = buildSampleHtml().catch((err: unknown) => {
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
