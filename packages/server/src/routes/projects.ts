import express, { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import type { SpecProject } from "@mockspec/shared";
import { extractZip, ZipSlipError } from "../unzip/extract.js";
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

export function projectsRouter(): Router {
  const router = Router();
  const json = express.json({ limit: "32mb" }); // spec.json 전체 교체 바디

  router.get("/projects", async (_req, res, next) => {
    try {
      res.json(await listProjects());
    } catch (err) {
      next(err);
    }
  });

  router.post("/projects", (req, res, next) => {
    uploadZip.single("zip")(req, res, (err: unknown) => {
      if (err) {
        if (isMulterLimit(err)) return sendError(res, "TOO_LARGE", "zip 파일이 200MB 제한을 초과했습니다.");
        return next(err);
      }
      void handleUpload(req, res, next);
    });
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

  router.put("/projects/:id", json, async (req, res, next) => {
    try {
      const { id } = req.params;
      const prev = await readSpec(id);
      if (!prev) return sendError(res, "NOT_FOUND", `프로젝트 ${id}를 찾을 수 없습니다.`);

      const body = req.body as Partial<SpecProject> | undefined;
      if (!body || typeof body !== "object" || body.version !== 1 || body.id !== id) {
        return sendError(res, "INVALID_REQUEST", "version(=1)·id가 경로와 일치해야 합니다.");
      }
      const saved = await replaceSpec(prev, body as SpecProject);
      res.json(saved);
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

  router.post("/projects/:id/export", exportProjectHtml);

  router.post("/projects/:id/assets", (req, res, next) => {
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

    const project = await createProject(name, file.originalname);
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
