import { PROJECT_DATA_ATTR } from "@mockspec/shared";
import { readBinding } from "./binding.js";

/**
 * [S2.5] content script — 바인딩된 오리진에만 SDK를 주입한다 (pathD 킥오프 §2).
 *
 * 주입은 페이지 DOM에 `<script src={확장 내 sdk.js}>` 태그를 넣는 방식:
 * - 확장 자원 로드라 대상 페이지 CSP(script-src)와 무관하다
 * - sdk.js는 기존 번들 그대로 — document.currentScript의 data-project로 부트 (main.tsx)
 * - 경로 A·B로 이미 SDK가 주입된 페이지는 건너뛴다 (이중 주입 방지)
 */

void (async () => {
  const binding = await readBinding(location.origin);
  if (!binding) return;

  if (document.querySelector(`script[${PROJECT_DATA_ATTR}]`)) return;

  const tag = document.createElement("script");
  tag.src = chrome.runtime.getURL("sdk.js");
  tag.setAttribute(PROJECT_DATA_ATTR, binding.projectId);
  (document.body ?? document.documentElement).appendChild(tag);
})();
