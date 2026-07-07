/**
 * 동결 무해화 검증 — single-file-core에 의존하지 않는 순수 파트(단위 검증 대상).
 * freeze.ts가 실제 동결 후 이 검증기로 <script> 0개를 강제한다 (§7.1).
 */

/** 동결 실패 (배지 + 재시도로 이어짐 — detailed-spec §3.7). */
export class FreezeError extends Error {
  override name = "FreezeError";
}

/**
 * HTML 안의 <script> 개수. 0이어야 한다 (§7.1 — "결과에 <script> 0개").
 * ld+json 같은 비실행 데이터 스크립트도 0개로 강제한다(뷰어 srcdoc 무해화의 제1 방어선).
 */
export function countScripts(html: string): number {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.querySelectorAll("script").length;
}
