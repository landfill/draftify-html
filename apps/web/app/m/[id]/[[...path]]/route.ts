import { getAuthedContext } from "@/lib/auth/require-user.js";
import { serveMockupFile } from "@/lib/mockup/serve.js";

type RouteCtx = { params: Promise<{ id: string; path?: string[] }> };

async function handle(req: Request, ctx: RouteCtx): Promise<Response> {
  const authed = await getAuthedContext();
  if (!authed) {
    return new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다." } }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id, path } = await ctx.params;
  return serveMockupFile(authed.db, id, path);
}

export async function GET(_req: Request, ctx: RouteCtx) {
  return handle(_req, ctx);
}

export async function HEAD(_req: Request, ctx: RouteCtx) {
  const res = await handle(_req, ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
