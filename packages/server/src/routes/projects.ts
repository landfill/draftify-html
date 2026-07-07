import { Router } from "express";
import multer from "multer";
import { extractZip, ZipSlipError } from "../unzip/extract.js";
import { createProject, listProjects } from "../store/projectStore.js";
import { mockupDir } from "../store/paths.js";
import { sendError } from "../errors.js";

/**
 * Spec API 중 T2 범위: 업로드(POST)와 목록(GET).
 * 나머지 CRUD·assets·export는 T3/T8에서 이 라우터에 추가한다. (technical-spec §6)
 */

/** zip 업로드 200MB 하드 리밋 (압축 파일 기준 — 해제 전에 걸림, technical-spec §3.2). */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

export function projectsRouter(): Router {
  const router = Router();

  router.get("/projects", async (_req, res, next) => {
    try {
      res.json(await listProjects());
    } catch (err) {
      next(err);
    }
  });

  router.post("/projects", (req, res, next) => {
    upload.single("zip")(req, res, (uploadErr: unknown) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === "LIMIT_FILE_SIZE") {
          return sendError(res, "TOO_LARGE", "zip 파일이 200MB 제한을 초과했습니다.");
        }
        return next(uploadErr);
      }
      void handleUpload(req, res, next);
    });
  });

  return router;
}

async function handleUpload(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      sendError(res, "INVALID_REQUEST", "zip 파일(field: zip)이 필요합니다.");
      return;
    }
    const name = typeof req.body?.name === "string" && req.body.name.trim()
      ? req.body.name.trim()
      : file.originalname.replace(/\.zip$/i, "");

    const project = await createProject(name, file.originalname);
    try {
      const result = await extractZip(file.buffer, mockupDir(project.id));
      res.status(201).json({
        project,
        mockupUrl: `//${project.id}.${req.hostname}`, // 서브도메인 — 오리진 하드코딩 없음
        extract: result,
      });
    } catch (extractErr) {
      if (extractErr instanceof ZipSlipError) {
        sendError(res, "INVALID_REQUEST", "zip에 디렉토리를 벗어나는 경로가 있어 거부했습니다.");
        return;
      }
      throw extractErr;
    }
  } catch (err) {
    next(err);
  }
}
