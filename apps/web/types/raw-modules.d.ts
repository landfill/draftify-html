/**
 * `?raw` 임포트 = 파일 내용을 문자열로 인라인(빌드 시점).
 * Vite(vitest)는 기본 지원, Next(webpack)는 `next.config.mjs`의 `asset/source` 룰이 처리한다.
 */
declare module "*?raw" {
  const content: string;
  export default content;
}
