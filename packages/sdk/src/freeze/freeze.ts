import { getPageData } from "single-file-core/single-file.js";
import { countScripts, FreezeError } from "./verify.js";
import { optimizeSnapshotImages } from "./optimizeImages.js";

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
 * - blockFonts: 웹폰트를 임베드하지 않고 시스템 폰트로 렌더 (킥오프 §11 11차)
 * - blockVideos/blockAudios: 미디어 콘텐츠 미임베드, 레이아웃 영역만 유지 (킥오프 §11 11차)
 * - saveFilenameTemplateData:false: 동결 후 옵션 JSON <script>가 재삽입되는 것 방지
 * - removedElementsSelector: SDK 자신(data-mockspec-root 호스트) 제외 (§5)
 * - loadDeferredImages:false: 이미 로드된 정적 목업 — 스크롤 조작/지연 불필요
 * - insertMetaCSP/insertSingleFileComment/saveFavicon:false: 스냅샷을 최소·무네트워크로
 * 나머지(이미지 data URI화, CSS 인라인, 미사용 스타일 제거)는 single-file 기본 동작.
 */
const FREEZE_OPTIONS: Record<string, unknown> = {
  blockScripts: true,
  // 폰트 임베드 금지 (킥오프 §11 11차) — 기획서는 레이아웃·구조 전달이 목적이라 시스템
  // 폰트로 충분하고, CJK 웹폰트는 웨이트당 수 MB라 스냅샷 비대화의 최대 원인이었다.
  // 폰트를 안 쓰므로 removeUnusedFonts·removeAlternativeFonts는 무의미 + 후자는 실사용
  // 크래시(local() 정규식) 진원이라 함께 끈다 → 크래시 표면도 감소.
  blockFonts: true,
  removeUnusedFonts: false,
  removeAlternativeFonts: false,
  // 비디오는 콘텐츠 대신 포스터+링크로 대체(single-file 기본 동작) — 재생 미디어 미임베드,
  // 요소(레이아웃 영역)는 남아 와이어프레임 자리로 표시된다 (킥오프 §11 11차).
  // 오디오·포스터는 single-file 옵션으로 못 막으므로 동결 직전 neutralizeMedia로 소스를 뗀다.
  blockVideos: true,
  // removeFrames:true 필수 — single-file의 프레임 캡처는 확장 프로그램 메시징
  // (chrome.runtime.sendMessage)에 의존한다. 우리는 페이지에 주입된 SDK라 그 경로가
  // 동작하지 않고 무한 대기에 빠진다. S1 목업은 단일 페이지라 iframe 캡처 불필요.
  removeFrames: true,
  removedElementsSelector: "[data-mockspec-root]",
  saveFilenameTemplateData: false,
  removeHiddenElements: true,
  removeUnusedStyles: true,
  compressHTML: true,
  loadDeferredImages: false,
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
 *
 * single-file-core는 실 사이트의 복잡한 CSS(예: `@media`/`@supports` 조건 파싱)를
 * 처리하다 내부에서 정규식 오류로 throw할 수 있다(경로 D 실사용 —
 * "Invalid regular expression: /^local(/"). 1차가 이미 폰트를 차단(blockFonts)하고
 * 폰트 대체·미사용 제거를 끄지만, 남은 CSS 최소화 단계(미사용 스타일·대체 미디어·
 * 이미지 그룹핑·압축)도 병적인 입력에서 throw할 수 있으므로 폴백에서 전부 끈다.
 * 폰트·미디어 차단(blockFonts·blockVideos·blockAudios)은 1차와 동일하게 유지된다(스프레드).
 * 핵심 무해화(blockScripts + <script> 0개 검증)도 폴백에서 그대로다.
 */
const SAFE_FALLBACK_OPTIONS: Record<string, unknown> = {
  ...FREEZE_OPTIONS,
  removeUnusedStyles: false,
  removeAlternativeMedias: false,
  groupDuplicateImages: false,
  compressHTML: false,
};

/**
 * 동결 직전 미디어 소스를 임시로 뗀다 (킥오프 §11 11차). 반환값을 호출해 복원한다.
 *
 * single-file은 오디오 소스와 비디오 poster를 그대로 임베드한다(blockVideos는 비디오
 * 재생 소스만 포스터+링크로 대체할 뿐 오디오·poster는 못 막는다). 재생 미디어·포스터는
 * 기획서에 불필요하고 임베드 시 수 MB~수십 MB가 되므로, 요소(레이아웃 영역)는 남기고
 * 로딩 속성(src/srcset/poster)만 잠시 비운다. 라이브 DOM 조작이라 finally에서 원복한다
 * (margin 처리와 동일한 임시 변형 패턴).
 */
export function neutralizeMedia(): () => void {
  const saved: Array<{ el: Element; attr: string; value: string }> = [];
  const MEDIA_SELECTOR = "audio, video, audio source, video source";
  const MEDIA_ATTRS = ["src", "srcset", "poster"];

  const strip = (root: ParentNode): void => {
    for (const el of Array.from(root.querySelectorAll(MEDIA_SELECTOR))) {
      for (const attr of MEDIA_ATTRS) {
        const value = el.getAttribute(attr);
        if (value != null) {
          saved.push({ el, attr, value });
          el.removeAttribute(attr);
        }
      }
    }
    // 열린 shadow DOM으로 재귀 — single-file은 open shadow root를 직렬화하므로 그 안의
    // 미디어도 임베드된다(웹 컴포넌트 목업). 우리 패널(data-mockspec-root)은 동결에서
    // 통째 제외되므로 그 서브트리는 건너뛴다.
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot && !el.matches("[data-mockspec-root]")) strip(el.shadowRoot);
    }
  };
  strip(document);

  return () => {
    for (const { el, attr, value } of saved) el.setAttribute(attr, value);
  };
}

async function runFreeze(options: Record<string, unknown>): Promise<string> {
  const { content } = await getPageData({ ...options }, {});
  // 큰 이미지 WebP 재인코딩 — 고해상도 이미지가 많은 페이지의 수십 MB 스냅샷 방지
  // (실사용 13차). best-effort: 실패한 이미지는 원본 유지, 동결을 깨지 않는다.
  const optimized = await optimizeSnapshotImages(content);
  const scripts = countScripts(optimized);
  if (scripts > 0) {
    throw new FreezeError(`동결 결과에 <script> ${scripts}개가 남아 폐기했습니다.`);
  }
  return optimized;
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
  const restoreMedia = neutralizeMedia();
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
    restoreMedia();
    html.style.marginRight = prevMargin;
    html.style.transition = prevTransition;
  }
}
