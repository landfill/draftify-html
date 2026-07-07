/**
 * Express 서버 진입점. — technical-spec §1.3, §3
 * 오리진 하드코딩 금지 (ID-01): 포트는 env로만. 서브도메인은 Host 헤더로 분기(app.ts).
 */
import { buildApp } from "./app.js";

/** 리스닝 포트. 오리진은 어디에도 하드코딩하지 않는다. */
export const PORT = Number(process.env.PORT ?? 4000);

const app = buildApp();
app.listen(PORT, () => {
  console.info(`[mockspec] server listening on http://localhost:${PORT}`);
  console.info(`[mockspec] 콘솔: http://localhost:${PORT}  |  목업: http://{projectId}.localhost:${PORT}`);
});
