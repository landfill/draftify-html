import { defineConfig } from "vite";

/**
 * SDK 번들: Vite lib mode → 단일 IIFE `dist/sdk.js` (주입 한 파일 원칙, technical-spec §1.2).
 * - CSS는 코드 안 문자열로 인라인(별도 .css 산출 없음) → 진짜 단일 파일 보장
 * - Preact JSX는 esbuild automatic runtime (jsxImportSource: preact)
 */
export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
  build: {
    lib: {
      entry: "src/main.tsx",
      name: "MockspecSDK",
      formats: ["iife"],
      fileName: () => "sdk.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    target: "es2020",
  },
});
