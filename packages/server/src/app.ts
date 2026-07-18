import express, { type Request, type Response, type NextFunction } from "express";
import { RESERVED_PATH_PREFIX } from "@mockspec/shared";
import { parseProjectSubdomain } from "./host.js";
import { consolePage } from "./routes/console.js";
import { guidePage, faqPage } from "./routes/pages.js";
import { samplePage } from "./routes/sample.js";
import { projectsRouter } from "./routes/projects.js";
import { serveMockup } from "./routes/serve.js";
import { sendError } from "./errors.js";

/**
 * Express 앱 조립. listen은 index.ts가 담당 (테스트는 buildApp을 supertest로 직접 구동).
 *
 * Host 헤더 분기 (technical-spec §3.1):
 *  - `{projectId}.localhost` → 목업 서빙 + SDK 주입 + SDK용 /__mockspec/api
 *  - `localhost`(루트)       → 콘솔 + /api
 * 두 경우 모두 same-origin API이므로 CORS 없음 (ID-03).
 */
export function buildApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  const api = projectsRouter();

  app.use((req: Request, res: Response, next: NextFunction) => {
    const projectId = parseProjectSubdomain(req.headers.host);

    if (projectId) {
      // 서브도메인: SDK가 부르는 same-origin API
      if (req.path.startsWith(`${RESERVED_PATH_PREFIX}/api/`)) {
        req.url = req.url.slice(`${RESERVED_PATH_PREFIX}/api`.length) || "/";
        return api(req, res, next);
      }
      // 그 외 전부 목업 서빙(정적 + 주입 + SPA fallback + /__mockspec/sdk.js)
      return void serveMockup(req, res, next, projectId);
    }

    // 루트(콘솔) 도메인: /api/*
    if (req.path === "/api" || req.path.startsWith("/api/")) {
      req.url = req.url.slice("/api".length) || "/";
      return api(req, res, next);
    }

    // 루트 = 콘솔 정적 페이지 (T9, detailed-spec §2) + 안내 페이지(가이드·FAQ·샘플 산출물)
    if (req.method === "GET" || req.method === "HEAD") {
      // trailing slash 정규화 — `/guide/`도 200 (리뷰 반영: 오탐 404 방지)
      const pagePath = req.path.replace(/\/+$/, "") || "/";
      if (pagePath === "/") return consolePage(req, res);
      if (pagePath === "/guide") return guidePage(req, res);
      if (pagePath === "/faq") return faqPage(req, res);
      if (pagePath === "/sample") return void samplePage(req, res, next);
    }
    return next();
  });

  app.use((req: Request, res: Response) => {
    sendError(res, "NOT_FOUND", `${req.method} ${req.path} 없음`);
  });

  // 최종 에러 핸들러 (ID-10). 상세는 서버 로그에만.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    sendError(res, "INTERNAL", "서버 내부 오류");
  });

  return app;
}
