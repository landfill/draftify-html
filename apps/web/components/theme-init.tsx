import Script from "next/script";

/** FOUC 방지 — shell.ts THEME_INIT_JS 와 동일. */
export function ThemeInitScript() {
  const js = `(function(){try{var t=localStorage.getItem("mockspec:theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
  return <Script id="theme-init" strategy="beforeInteractive">{js}</Script>;
}
