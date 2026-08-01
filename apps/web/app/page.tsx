import { ConsoleHome } from "@/components/console-home.js";
import { LandingHome } from "@/components/landing-home.js";
import { ShellHeader } from "@/components/shell-header.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";
import { listProjectsForConsole } from "@/lib/store/projectList.js";

export default async function HomePage() {
  const ctx = await getAuthedContext();
  /*
    `/`는 공개 서비스의 첫인상과 로그인 뒤 작업 기점을 함께 맡는다 (이슈 #85).
    비로그인 사용자를 곧장 로그인 폼으로 보내면 서비스가 무엇인지 설명할 지점이 없고,
    별도 랜딩 경로를 만들면 같은 의미의 홈이 둘이 된다. 그래서 경로는 하나로 유지하되
    세션이 없을 때만 소개 화면을 렌더한다. 콘솔 데이터는 아래 인증 분기 뒤에서만 읽는다.
  */
  if (!ctx) {
    return (
      <>
        <ShellHeader />
        <LandingHome />
      </>
    );
  }
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
