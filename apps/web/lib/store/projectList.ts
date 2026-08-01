import type { ProjectListItem } from "@mockspec/shared";
import type { Db } from "./ids.js";
import { exportSummary } from "./exportStore.js";
import { listProjects } from "./projectStore.js";

/**
 * 콘솔 목록 화면이 쓰는 형태 — 프로젝트 + export 요약.
 *
 * **RSC(`app/page.tsx`)와 API 라우트(`GET /api/projects`)가 같은 함수를 쓴다** (이슈 #81).
 * 콘솔 홈은 서버에서 미리 실어 보내고(첫 화면), 이후 갱신(업로드·삭제·토큰 발급)은
 * 라우트를 부른다 — 두 곳에 조회를 복제하면 요약 형태가 조용히 갈라진다.
 *
 * 요약은 프로젝트마다 조회한다(1 + N). 한 번에 합치지 않는 이유는 `exportSummary` 주석에
 * 있다 — 합치면 PostgREST 행 상한이 사용자 전체 합계에 걸려 숫자가 조용히 틀린다.
 * 사용자당 프로젝트는 20개가 상한이라(`LIMITS.maxProjectsPerUser`) 왕복 수도 그만큼에서 멈춘다.
 */
export async function listProjectsForConsole(db: Db): Promise<ProjectListItem[]> {
  const projects = await listProjects(db);
  return Promise.all(projects.map(async (p) => ({ ...p, ...(await exportSummary(db, p.id)) })));
}
