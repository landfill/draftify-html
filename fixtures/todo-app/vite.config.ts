import { defineConfig } from "vite";

// 루트 base 빌드 (콘솔 안내 문구의 지원 형태 중 하나 — ID-12)
export default defineConfig({
  base: "/",
  build: { outDir: "dist", emptyOutDir: true },
});
