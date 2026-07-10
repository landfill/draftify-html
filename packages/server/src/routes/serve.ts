import path from "node:path";
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import type { Request, Response, NextFunction } from "express";
import { RESERVED_PATH_PREFIX } from "@mockspec/shared";
import { mockupDir } from "../store/paths.js";
import { readSpec } from "../store/projectStore.js";
import { injectSdkTag } from "../inject.js";
import { readSdkBundle } from "../sdkBundle.js";
import { proxyMockup } from "./proxy.js";
import { sendError } from "../errors.js";

/**
 * 목업 서빙 (technical-spec §3.2): 서브도메인으로 들어온 요청을 해당 프로젝트의
 * mockup/ 디렉토리에서 정적 서빙하고, text/html에는 SDK 태그를 주입한다.
 * 예약 경로 /__mockspec/* 는 목업 파일보다 우선. SDK 번들은 sdkBundle.ts가 해석.
 */

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

/** mockupDir 안으로만 경로를 정규화. 이탈하면 null (서빙 단계의 zip-slip 대응). */
function safeResolve(root: string, urlPath: string): string | null {
  const decoded = decodeURIComponent(urlPath);
  const target = path.resolve(root, "." + (decoded.startsWith("/") ? decoded : "/" + decoded));
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

async function statSafe(p: string): Promise<import("node:fs").Stats | null> {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

async function sendHtmlInjected(res: Response, filePath: string, projectId: string): Promise<void> {
  const html = await fs.readFile(filePath, "utf8");
  res.type("text/html; charset=utf-8").send(injectSdkTag(html, projectId));
}

function sendStatic(res: Response, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  res.type(MIME[ext] ?? "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

/** 서브도메인 요청 처리. app.ts가 projectId를 확정한 뒤 호출한다. */
export async function serveMockup(
  req: Request,
  res: Response,
  next: NextFunction,
  projectId: string,
): Promise<void> {
  try {
    // 예약 경로: SDK 자산
    if (req.path === `${RESERVED_PATH_PREFIX}/sdk.js`) {
      const { body } = await readSdkBundle();
      res.type("text/javascript; charset=utf-8").send(body);
      return;
    }
    // /__mockspec/api/* 는 app.ts에서 이미 API 라우터로 처리됨 (여기 도달 시 미구현 경로)
    if (req.path.startsWith(`${RESERVED_PATH_PREFIX}/`)) {
      sendError(res, "NOT_FOUND", `예약 경로 미구현: ${req.path}`);
      return;
    }

    const project = await readSpec(projectId);
    if (!project) {
      sendError(res, "NOT_FOUND", `프로젝트 ${projectId}를 찾을 수 없습니다.`);
      return;
    }

    // 경로 B: URL 프록시 프로젝트는 정적 서빙 대신 오리진으로 프록시 (§3.3).
    // 예약 경로(/__mockspec/sdk.js·api)는 위에서 이미 로컬 처리됨 — 프록시로 넘어가지 않는다.
    if (project.mockupSource.type === "proxy") {
      proxyMockup(req, res, project.mockupSource.originUrl, projectId);
      return;
    }

    const root = mockupDir(projectId);
    const resolved = safeResolve(root, req.path);
    if (!resolved) {
      sendError(res, "INVALID_REQUEST", "잘못된 경로입니다.");
      return;
    }

    const stat = await statSafe(resolved);
    if (stat?.isFile()) {
      if (path.extname(resolved).toLowerCase().match(/\.html?$/)) {
        await sendHtmlInjected(res, resolved, projectId);
      } else {
        sendStatic(res, resolved);
      }
      return;
    }

    if (stat?.isDirectory()) {
      const indexPath = path.join(resolved, "index.html");
      if (await statSafe(indexPath)) {
        await sendHtmlInjected(res, indexPath, projectId);
        return;
      }
    }

    // SPA fallback: 확장자 없는 미존재 경로 → 루트 index.html (technical-spec §3.2)
    if (!path.extname(req.path)) {
      const rootIndex = path.join(root, "index.html");
      if (await statSafe(rootIndex)) {
        await sendHtmlInjected(res, rootIndex, projectId);
        return;
      }
    }

    sendError(res, "NOT_FOUND", `${req.path}를 찾을 수 없습니다.`);
  } catch (err) {
    next(err);
  }
}
