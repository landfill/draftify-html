import type { ProjectListItem } from "@mockspec/shared";
import type { Db } from "./ids.js";
import { exportSummaries } from "./exportStore.js";
import { listProjects } from "./projectStore.js";

/**
 * 콘솔 목록 화면이 쓰는 형태 — 프로젝트 + export 요약.
 *
 * **RSC(`app/page.tsx`)와 API 라우트(`GET /api/projects`)가 같은 함수를 쓴다** (이슈 #81).
 * 콘솔 홈은 서버에서 미리 실어 보내고(첫 화면), 이후 갱신(업로드·삭제·토큰 발급)은
 * 라우트를 부른다 — 두 곳에 조회를 복제하면 요약 형태가 조용히 갈라진다.
 *
 * 왕복은 **2회 고정**이다(목록 1 + 요약 1). 프로젝트 수에 비례하지 않는다.
 */
export async function listProjectsForConsole(db: Db): Promise<ProjectListItem[]> {
  const projects = await listProjects(db);
  const summaries = await exportSummaries(
    db,
    projects.map((p) => p.id),
  );
  return projects.map((p) => ({
    ...p,
    ...(summaries.get(p.id) ?? { exportCount: 0 }),
  }));
}
