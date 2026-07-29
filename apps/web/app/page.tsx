import { redirect } from "next/navigation";
import { ConsoleHome } from "@/components/console-home.js";
import { ShellHeader } from "@/components/shell-header.js";
import { getAuthedContext } from "@/lib/auth/require-user.js";

export default async function HomePage() {
  const ctx = await getAuthedContext();
  if (!ctx) redirect("/login");
  return (
    <>
      <ShellHeader active="home" email={ctx.user.email} />
      <ConsoleHome />
    </>
  );
}
