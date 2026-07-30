"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EDITION_NAME } from "@mockspec/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client.js";

type NavActive = "home" | "guide" | "faq";

export function ShellHeader({ active, email }: { active?: NavActive; email?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("mockspec:theme");
    if (stored === "dark" || stored === "light") setTheme(stored);
  }, []);

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
        {email ? <span className="c-user-email">{email}</span> : null}
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
        {email ? (
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
