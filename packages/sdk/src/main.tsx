import { render } from "preact";
import { PROJECT_DATA_ATTR } from "@mockspec/shared";
import { App } from "./ui/App.js";
import { STYLES } from "./styles.js";

/**
 * SDK 진입점. 주입 태그(<script src="/__mockspec/sdk.js" data-project defer>)로 로드되어
 * Shadow DOM 안에 편집 UI를 mount한다. (technical-spec §3.2, 킥오프 §6.1)
 *
 * defer 스크립트 실행 시점에 document.currentScript가 주입 태그를 가리키므로
 * 여기서 projectId를 즉시 읽는다.
 */
const projectId = document.currentScript?.getAttribute(PROJECT_DATA_ATTR) ?? null;

function boot(): void {
  if (!projectId) {
    console.warn("[mockspec] data-project 속성이 없어 SDK를 mount하지 않습니다.");
    return;
  }
  if (document.querySelector("[data-mockspec-root]")) return; // 중복 mount 방지

  const host = document.createElement("div");
  host.setAttribute("data-mockspec-root", ""); // 동결 대상 제외 마킹 (T6)
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  shadow.appendChild(style);

  const mount = document.createElement("div");
  shadow.appendChild(mount);
  render(<App projectId={projectId} />, mount);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
