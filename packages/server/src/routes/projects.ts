import express, { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import type { ProjectListItem, SpecProject } from "@mockspec/shared";
import { extractZip, ZipSlipError } from "../unzip/extract.js";
import { validateOrigin, SsrfError } from "../proxy/ssrfGuard.js";
import {
  createProject,
  listProjects,
  readSpec,
  replaceSpec,
  deleteProject,
  saveAsset,
  readAsset,
} from "../store/projectStore.js";
import { mockupDir } from "../store/paths.js";
import { exportSummary } from "../store/exportStore.js";
import { verifyToken, issueToken, revokeToken } from "../store/tokenStore.js";
import { sendError } from "../errors.js";
import { exportProjectHtml } from "./export.js";

/** Spec API 전체 (technical-spec §6). */

/** zip 업로드 200MB 하드 리밋 (압축 파일 기준 — 해제 전에 걸림, technical-spec §3.2). */
const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

/** 동결 스냅샷 50MB 제한 (ID-11 — 장면 하나가 50MB면 산출물이 성립 불가). */
const uploadAsset = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function isMulterLimit(err: unknown): boolean {
  return err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
}

/**
 * [T29] 작성자 라벨 정규화 — 선택 입력, 표시용(인증 아님, POL-M09).
 * 공백 정리 + 60자 컷 (카드·산출물 헤더 한 줄 표시가 목적이라 그 이상은 의미 없음).
 */
function parseOwnerLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 60);
  return trimmed || undefined;
}

/**
 * [S2.5] 경로 D 저장 토큰 게이트 (pathD 킥오프 §4.1, technical-spec §6).
 * `snippet` 프로젝트의 저장 계열(PUT·assets·export)만 `Authorization: Bearer` 필수 —
 * 경로 D의 SDK는 서비스 도메인 밖 임의 오리진에서 돌아 same-origin 신뢰가 없다.
 * upload·proxy 프로젝트는 기존 무인증 그대로 (사내망 + same-origin 전제, ID-03).
 */
async function requireSnippetToken(
  req: express.Request<{ id: string }>,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    const spec = await readSpec(req.params.id);
    if (!spec) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);
    if (spec.mockupSource.type !== "snippet") return next();

    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
    if (!m || !(await verifyToken(spec.id, m[1]!))) {
      return sendError(res, "UNAUTHORIZED", "유효한 프로젝트 토큰이 필요합니다 (Authorization: Bearer).");
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function projectsRouter(): Router {
  const router = Router();
  const json = express.json({ limit: "32mb" }); // spec.json 전체 교체 바디

  router.get("/projects", async (_req, res, next) => {
    try {
      // [T29] 콘솔 목록에 산출물 이력 요약 동봉 (technical-spec §6.3)
      const projects = await listProjects();
      const items: ProjectListItem[] = await Promise.all(
        projects.map(async (p) => ({ ...p, ...(await exportSummary(p.id)) })),
      );
      res.json(items);
    } catch (err) {
      next(err);
    }
  });

  router.post("/projects", (req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("application/json")) {
      express.json({ limit: "32mb" })(req, res, (err) => {
        if (err) return next(err);
        // JSON 등록 분기: 경로 D(snippet) vs 경로 B(proxy)
        if ((req.body as { source?: unknown } | undefined)?.source === "snippet") {
          void handleSnippetRegistration(req, res, next);
        } else {
          void handleProxyRegistration(req, res, next);
        }
      });
    } else {
      uploadZip.single("zip")(req, res, (err: unknown) => {
        if (err) {
          if (isMulterLimit(err)) return sendError(res, "TOO_LARGE", "zip 파일이 200MB 제한을 초과했습니다.");
          return next(err);
        }
        void handleUpload(req, res, next);
      });
    }
  });

  router.get("/projects/:id", async (req, res, next) => {
    try {
      const spec = await readSpec(req.params.id);
      if (!spec) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);
      res.json(spec);
    } catch (err) {
      next(err);
    }
  });

  router.put("/projects/:id", requireSnippetToken, json, async (req, res, next) => {
    try {
      const { id } = req.params;
      const prev = await readSpec(id);
      if (!prev) return sendError(res, "NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);

      const body = req.body as Partial<SpecProject> | undefined;
      if (!body || typeof body !== "object" || body.version !== 1 || body.id !== id) {
        return sendError(res, "INVALID_REQUEST", "version(=1)·id가 경로와 일치해야 합니다.");
      }
      // [S2.5] snippet 프로젝트의 mockupSource는 서버 소유 메타 — 클라이언트 값 대신
      // 이전 값을 유지하고, 확장 background가 붙인 페이지 오리진만 표시용으로 스탬프.
      if (prev.mockupSource.type === "snippet") {
        const pageOrigin = req.headers["x-mockspec-page-origin"];
        body.mockupSource = {
          ...prev.mockupSource,
          ...(typeof pageOrigin === "string" && pageOrigin ? { lastSeenOrigin: pageOrigin } : {}),
        };
      }
      const saved = await replaceSpec(prev, body as SpecProject);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  // [S2.5] 경로 D 토큰 재발급(POST — 구 토큰 즉시 무효)·폐기(DELETE). 경로 D 프로젝트 한정.
  // 콘솔(루트 도메인) 조작 전제 — 삭제와 동일하게 확인 책임은 콘솔 UI에 있다.
  router.post("/projects/:id/token", async (req, res, next) => {
    try {
      const spec = await readSpec(req.params.id);
      if (!spec) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);
      if (spec.mockupSource.type !== "snippet") {
        return sendError(res, "INVALID_REQUEST", "확장(경로 D) 프로젝트만 토큰을 사용합니다.");
      }
      const token = await issueToken(spec.id);
      res.status(201).json({ token });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/projects/:id/token", async (req, res, next) => {
    try {
      const spec = await readSpec(req.params.id);
      if (!spec) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);
      if (spec.mockupSource.type !== "snippet") {
        return sendError(res, "INVALID_REQUEST", "확장(경로 D) 프로젝트만 토큰을 사용합니다.");
      }
      await revokeToken(spec.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.delete("/projects/:id", async (req, res, next) => {
    try {
      const spec = await readSpec(req.params.id);
      if (!spec) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);
      await deleteProject(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post("/projects/:id/export", requireSnippetToken, exportProjectHtml);

  router.post("/projects/:id/assets", requireSnippetToken, (req, res, next) => {
    uploadAsset.single("snapshot")(req, res, (err: unknown) => {
      if (err) {
        if (isMulterLimit(err)) return sendError(res, "TOO_LARGE", "스냅샷이 50MB 제한을 초과했습니다.");
        return next(err);
      }
      void handleAssetUpload(req, res, next);
    });
  });

  router.get("/projects/:id/assets/:key", async (req, res, next) => {
    try {
      const data = await readAsset(req.params.id, req.params.key);
      if (!data) return sendError(res, "NOT_FOUND", "asset을 찾을 수 없습니다.");
      res.type("text/html; charset=utf-8").send(data);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function handleUpload(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    const file = req.file;
    if (!file) return sendError(res, "INVALID_REQUEST", "zip 파일(field: zip)이 필요합니다.");
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : file.originalname.replace(/\.zip$/i, "");

    const project = await createProject(
      name,
      { type: "upload", originalFilename: file.originalname },
      parseOwnerLabel(req.body?.ownerLabel),
    );
    try {
      const result = await extractZip(file.buffer, mockupDir(project.id));

      // 해제(제외 처리) 후 루트 index.html 없으면 업로드 거부 (detailed-spec §2.2·§6)
      const hasIndex = await fs
        .access(path.join(mockupDir(project.id), "index.html"))
        .then(() => true, () => false);
      if (!hasIndex) {
        await deleteProject(project.id);
        return sendError(res, "INVALID_REQUEST", "빌드 산출물 루트에 index.html이 필요합니다.");
      }

      res.status(201).json({
        project,
        mockupUrl: `//${project.id}.${req.hostname}`, // 서브도메인 — 오리진 하드코딩 없음
        extract: result,
      });
    } catch (extractErr) {
      // 거부된 업로드의 빈 프로젝트를 남기지 않는다 (zip-slip·해제 실패 공통)
      await deleteProject(project.id);
      if (extractErr instanceof ZipSlipError) {
        return sendError(res, "INVALID_REQUEST", "zip에 디렉토리를 벗어나는 경로가 있어 거부했습니다.");
      }
      return sendError(res, "INVALID_REQUEST", "zip 파일을 확인해주세요.");
    }
  } catch (err) {
    next(err);
  }
}

async function handleAssetUpload(
  req: express.Request<{ id: string }>,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    const spec = await readSpec(req.params.id);
    if (!spec) return sendError(res, "NOT_FOUND", `프로젝트 ${req.params.id}를 찾을 수 없습니다.`);
    if (!req.file) return sendError(res, "INVALID_REQUEST", "스냅샷 파일(field: snapshot)이 필요합니다.");
    const assetKey = await saveAsset(req.params.id, req.file.buffer);
    res.status(201).json({ assetKey });
  } catch (err) {
    next(err);
  }
}

/**
 * [S2.5] 경로 D 프로젝트 등록 (pathD 킥오프 §3·§6).
 * 오리진 검증·도달성 확인이 없다 — 서버가 아무것도 fetch하지 않는 경로.
 * 토큰 평문은 이 응답 1회뿐 (서버는 해시만 보관).
 */
async function handleSnippetRegistration(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      return sendError(res, "INVALID_REQUEST", "프로젝트 이름이 필요합니다.");
    }
    const project = await createProject(name, { type: "snippet" }, parseOwnerLabel(req.body.ownerLabel));
    const token = await issueToken(project.id);
    res.status(201).json({ project, token });
  } catch (err) {
    next(err);
  }
}

async function handleProxyRegistration(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    const originUrl = typeof req.body.originUrl === "string" ? req.body.originUrl.trim() : "";

    if (!name || !originUrl) {
      return sendError(res, "INVALID_REQUEST", "프로젝트 이름과 오리진 URL이 필요합니다.");
    }

    try {
      await validateOrigin(originUrl);
    } catch (e) {
      if (e instanceof SsrfError) {
        return sendError(res, "INVALID_REQUEST", e.message);
      }
      throw e;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch(originUrl, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
    } catch (err) {
      return sendError(res, "INVALID_REQUEST", "오리진에 도달할 수 없습니다.");
    }

    const project = await createProject(name, { type: "proxy", originUrl }, parseOwnerLabel(req.body.ownerLabel));

    res.status(201).json({
      project,
      mockupUrl: `//${project.id}.${req.hostname}`,
    });
  } catch (err) {
    next(err);
  }
}
