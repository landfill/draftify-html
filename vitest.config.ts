import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 아직 테스트가 없는 패키지가 있어도 CI가 실패하지 않도록. 실제 테스트는 T3부터.
    passWithNoTests: true,
    include: ["packages/**/*.{test,spec}.ts"],
  },
});
