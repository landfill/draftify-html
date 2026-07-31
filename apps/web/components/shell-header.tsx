"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EDITION_NAME } from "@mockspec/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client.js";

type NavActive = "home" | "guide" | "faq";

export function ShellHeader({ active, email }: { active?: NavActive; email?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  /**
   * 로그인 상태. `email` prop은 서버 컴포넌트가 인증을 이미 확인한 페이지(콘솔 홈)에서만 온다.
   * `/guide`·`/faq`는 로그인 없이 볼 수 있는 정적 페이지라 prop이 없는데, 그렇다고 로그인한
   * 사용자에게 [로그인]을 보여주면 안 된다 → prop이 없을 때만 브라우저에서 세션을 확인한다.
   * 확인이 끝나기 전에는 둘 중 어느 것도 그리지 않는다(틀린 버튼을 깜빡이지 않게).
   */
  const [session, setSession] = useState<{ email: string | null } | null>(
    email ? { email } : null,
  );

  useEffect(() => {
    const stored = localStorage.getItem("mockspec:theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

  useEffect(() => {
    if (email) return; // 서버가 이미 확인했다.
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!cancelled) setSession({ email: data.user?.email ?? null });
      })
      .catch(() => {
        if (!cancelled) setSession({ email: null });
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("mockspec:theme", next);
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const navCls = (name: NavActive) =>
    `c-nav-link${active === name ? " is-active" : ""}`;

  return (
    <header className="c-header">
      <Link href="/" className="c-logo">
        {EDITION_NAME.cloud}
      </Link>
      <div className="c-header-right">
        {session?.email ? <span className="c-user-email">{session.email}</span> : null}
        {/*
          작업 기점(프로젝트 목록)으로 **돌아오는** 링크 (이슈 #77). 이전에는 로고 클릭이
          유일한 길이었는데, "로고 = 홈"은 학습된 관행이라 처음 쓰는 사람이 찾지 못했다.

          비로그인 상태에서도 보여 준다: 로그인 없이 가이드를 읽던 사람에게도 돌아갈 길이
          있어야 한다. `/`는 보호 경로라 누르면 로그인 화면으로 가는데, 프로젝트를 보려면
          어차피 로그인이 필요하므로 그게 자연스러운 다음 걸음이다.
        */}
        <Link href="/" className={navCls("home")}>
          내 프로젝트
        </Link>
        <Link href="/guide" className={navCls("guide")}>
          사용 가이드
        </Link>
        <a href="/sample" className="c-nav-link" target="_blank" rel="noopener noreferrer">
          샘플 보기
        </a>
        <Link href="/faq" className={navCls("faq")}>
          FAQ
        </Link>
        <button
          type="button"
          className="c-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
          title={theme === "dark" ? "라이트 모드" : "다크 모드"}
        />
        {session === null ? null : session.email ? (
          <button type="button" className="c-btn c-btn-ghost" onClick={() => void signOut()}>
            로그아웃
          </button>
        ) : (
          <Link href="/login" className="c-nav-link">
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
