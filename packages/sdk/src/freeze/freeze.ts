import { getPageData } from "single-file-core/single-file.js";
import { countScripts, FreezeError } from "./verify.js";

/**
 * 장면 동결 (technical-spec §5, 킥오프 §7).
 * single-file-core를 클라이언트(사용자 브라우저)에서 실행해 현재 DOM을 단독 HTML
 * 문자열로 굳힌다. "동결은 클라이언트에서만, 서버 헤드리스 재현 금지" 결정의 구현.
 * <script> 0개 검증(verify.ts)은 single-file-core를 로드하지 않는 순수 모듈로 분리.
 */

export { countScripts, FreezeError } from "./verify.js";

/**
 * single-file-core 옵션. 핵심:
 * - blockScripts: 모든 <script> 제거 (핵심 무해화 — §7.1, 아래 검증으로 이중 강제)
 * - saveFilenameTemplateData:false: 동결 후 옵션 JSON <script>가 재삽입되는 것 방지
 * - removedElementsSelector: SDK 자신(data-mockspec-root 호스트) 제외 (§5)
 * - loadDeferredImages:false: 이미 로드된 정적 목업 — 스크롤 조작/지연 불필요
 * - insertMetaCSP/insertSingleFileComment/saveFavicon:false: 스냅샷을 최소·무네트워크로
 * 나머지(이미지·폰트 data URI화, CSS 인라인, 미사용 스타일 제거)는 single-file 기본 동작.
 */
const FREEZE_OPTIONS: Record<string, unknown> = {
  blockScripts: true,
  // removeFrames:true 필수 — single-file의 프레임 캡처는 확장 프로그램 메시징
  // (chrome.runtime.sendMessage)에 의존한다. 우리는 페이지에 주입된 SDK라 그 경로가
  // 동작하지 않고 무한 대기에 빠진다. S1 목업은 단일 페이지라 iframe 캡처 불필요.
  removeFrames: true,
  removedElementsSelector: "[data-mockspec-root]",
  saveFilenameTemplateData: false,
  removeHiddenElements: true,
  removeUnusedStyles: true,
  removeUnusedFonts: true,
  compressHTML: true,
  loadDeferredImages: false,
  blockVideos: false,
  blockAudios: false,
  removeAlternativeFonts: true,
  removeAlternativeMedias: true,
  removeAlternativeImages: true,
  groupDuplicateImages: true,
  saveFavicon: false,
  insertMetaCSP: false,
  insertSingleFileComment: false,
  maxResourceSize: 50, // MB — asset store 상한(§6)과 정렬
};

/**
 * CSS 최소화를 끈 안전 폴백 옵션.
 * single-file-core는 실 사이트의 복잡한 CSS(예: `@font-face`의 `local()` 소스, 벤더 해킹)를
 * 파싱하다 내부에서 정규식 오류로 throw하는 경우가 있다(경로 D 실사용에서 확인 —
 * "Invalid regular expression: /^local(/"). 이 오류들은 **미사용 폰트·스타일 제거**와
 * CSS 압축 경로에 몰려 있으므로, 그 최적화들을 꺼서 재시도한다. 스냅샷이 다소 커지지만
 * 시각적 완전성과 네트워크 0건 원칙은 유지된다(핵심 무해화 blockScripts는 그대로).
 */
const SAFE_FALLBACK_OPTIONS: Record<string, unknown> = {
  ...FREEZE_OPTIONS,
  removeUnusedFonts: false,
  removeAlternativeFonts: false,
  removeUnusedStyles: false,
  removeAlternativeMedias: false,
  groupDuplicateImages: false,
  compressHTML: false,
};

async function runFreeze(options: Record<string, unknown>): Promise<string> {
  const { content } = await getPageData({ ...options }, {});
  const scripts = countScripts(content);
  if (scripts > 0) {
    throw new FreezeError(`동결 결과에 <script> ${scripts}개가 남아 폐기했습니다.`);
  }
  return content;
}

/**
 * 현재 문서를 동결해 단독 HTML 문자열을 반환한다.
 * 패널 도킹으로 <html>에 걸린 margin-right는 스냅샷에서 제거(원본 레이아웃 보존).
 * <script>가 하나라도 남으면 FreezeError → 호출부가 배지+재시도로 처리.
 *
 * 1차(전체 최적화)가 single-file 내부 오류로 실패하면 CSS 최소화를 끈 폴백으로 자동 재시도한다.
 * FreezeError(우리 검증 실패)는 폴백으로도 못 고치므로 그대로 전파한다.
 */
export async function freezeDocument(): Promise<string> {
  const html = document.documentElement;
  const prevMargin = html.style.marginRight;
  const prevTransition = html.style.transition;
  html.style.transition = "none";
  html.style.marginRight = "";
  try {
    try {
      return await runFreeze(FREEZE_OPTIONS);
    } catch (err) {
      if (err instanceof FreezeError) throw err; // <script> 잔존 등 우리 규칙 위반은 재시도 무의미
      // single-file 내부 오류(정규식 등) → CSS 최소화 끈 폴백으로 1회 재시도
      console.warn("[mockspec] 동결 1차 실패, 안전 옵션으로 재시도:", err);
      return await runFreeze(SAFE_FALLBACK_OPTIONS);
    }
  } finally {
    html.style.marginRight = prevMargin;
    html.style.transition = prevTransition;
  }
}
