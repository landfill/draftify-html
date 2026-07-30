"use client";

import { useEffect, useState } from "react";
import { EDITION_NAME } from "@mockspec/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client.js";

export function LoginForm({ errorCode }: { errorCode?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [redirectTo, setRedirectTo] = useState("");

  useEffect(() => {
    setRedirectTo(`${window.location.origin}/auth/callback`);
  }, []);

  async function signInWithGoogle() {
    if (!redirectTo) return;
    setBusy(true);
    setStatus(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setStatus(error.message);
      setBusy(false);
    }
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!redirectTo) return;
    setBusy(true);
    setStatus(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setStatus(error.message);
    else setStatus("로그인 링크를 이메일로 보냈습니다. 메일함을 확인하세요.");
  }

  return (
    <div className="c-login-card c-card">
      <h1 className="c-section-title">{EDITION_NAME.cloud} — 로그인</h1>
      {errorCode === "auth_callback_failed" ? (
        <p className="c-status is-error">로그인 처리에 실패했습니다. 다시 시도해 주세요.</p>
      ) : null}
      <button
        type="button"
        className="c-btn"
        style={{ width: "100%" }}
        disabled={busy || !redirectTo}
        onClick={() => void signInWithGoogle()}
      >
        Google로 계속
      </button>
      <p className="c-login-divider">또는 이메일 매직링크</p>
      <form onSubmit={(e) => void signInWithEmail(e)}>
        <div className="c-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <label htmlFor="login-email" style={{ textAlign: "left", flex: "none" }}>
            이메일
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ maxWidth: "none" }}
          />
        </div>
        <button
          type="submit"
          className="c-btn"
          style={{ width: "100%", marginLeft: 0 }}
          disabled={busy || !redirectTo}
        >
          매직링크 보내기
        </button>
      </form>
      {status ? <p className={`c-status ${status.includes("보냈") ? "is-ok" : "is-error"}`}>{status}</p> : null}
    </div>
  );
}
