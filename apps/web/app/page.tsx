import { redirect } from "next/navigation";
import { ConsoleHome } from "@/components/console-home.js";
import { ShellHeader } from "@/components/shell-header.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { listProjectsForConsole } from "@/lib/store/projectList.js";

export default async function HomePage() {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  /*
    목록을 **서버에서 미리 실어 보낸다** (이슈 #81). 이전에는 브라우저가 HTML을 받고
    마운트된 뒤에야 `/api/projects`를 불러서, 목록이 뜨기까지 왕복이 한 번 더 붙었다
    (실측: 목록 표시 924ms 중 577ms가 그 구간).

    여기서 실패하면 페이지 전체가 실패한다 — 목록을 못 읽는 상태에서 업로드 폼만
    보여 주는 것은 사용자에게 "프로젝트가 없다"는 잘못된 인상을 준다.
  */
  const projects = await listProjectsForConsole(ctx.db);
  return (
    <>
      <ShellHeader active="home" email={ctx.user.email} />
      <ConsoleHome initialProjects={projects} />
    </>
  );
}
