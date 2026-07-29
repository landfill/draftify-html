import { ShellHeader } from "@/components/shell-header.js";
import { LoginForm } from "@/components/login-form.js";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <ShellHeader />
      <LoginForm errorCode={error} />
    </>
  );
}
