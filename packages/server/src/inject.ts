import { RESERVED_PATH_PREFIX, PROJECT_DATA_ATTR } from "@mockspec/shared";

/**
 * text/html 응답의 </body> 직전에 SDK 로더 태그를 삽입한다. (technical-spec §3.2, ID-03)
 * SDK는 data-project 속성으로 자기 프로젝트를 식별한다. src는 상대 경로 예약 경로 —
 * 오리진 하드코딩 없음.
 */
export function injectSdkTag(html: string, projectId: string): string {
  const tag =
    `<script src="${RESERVED_PATH_PREFIX}/sdk.js" ` +
    `${PROJECT_DATA_ATTR}="${projectId}" defer></script>`;

  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx === -1) return html + tag; // </body> 없는 목업도 동작하도록 말미에 부착
  return html.slice(0, idx) + tag + html.slice(idx);
}
