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

  /*
    레이아웃은 전부 `.c-login-*` CSS가 잡는다 (이슈 #87). 이전에는 인라인 `style`로 콘솔의
    2단 폼 그리드(`.c-row`의 120px 우측 정렬 라벨)를 이 화면에서만 되돌리고 있었다 — 같은
    땜질이 화면마다 반복되므로 규칙을 CSS 한 곳으로 옮겼다.
  */
  return (
    <div className="c-login-card c-card">
      <h1 className="c-login-title">로그인</h1>
      <p className="c-login-sub">
        {EDITION_NAME.cloud} — 목업에 설명을 달아 단독 HTML 기획서로 내보냅니다. 계정이 없어도
        첫 로그인에 자동으로 만들어집니다.
      </p>
      {errorCode === "auth_callback_failed" ? (
        <p className="c-status is-error">로그인 처리에 실패했습니다. 다시 시도해 주세요.</p>
      ) : null}
      {/*
        소셜 로그인은 보조 형태(테두리)로 둔다. 이전에는 이 버튼과 [매직링크 보내기]가 둘 다
        채움 강조색이라 무엇이 주 동작인지 읽히지 않았다.
      */}
      <button
        type="button"
        className="c-btn c-btn-social"
        disabled={busy || !redirectTo}
        onClick={() => void signInWithGoogle()}
      >
        Google로 계속
      </button>
      <p className="c-login-divider">또는</p>
      <form onSubmit={(e) => void signInWithEmail(e)}>
        <div className="c-row">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <button type="submit" className="c-btn" disabled={busy || !redirectTo}>
          매직링크 보내기
        </button>
      </form>
      {status ? <p className={`c-status ${status.includes("보냈") ? "is-ok" : "is-error"}`}>{status}</p> : null}
    </div>
  );
}
