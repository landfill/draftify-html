import type { Anchor, Annotation, Scene, SpecProject } from "@mockspec/shared";

type ResolveMode = "selector" | "refind" | "rect-fallback";

interface ResolveResult {
  el: Element | null;
  mode: ResolveMode;
  selector: string;
}

interface ViewerState {
  activeAnnotationId: string | null;
  selectedSceneId: string | null;
  /** 왼쪽 장면 네비 접힘 — 넓은 캡처에서 중앙을 넓혀 가로 스크롤을 줄인다 */
  sidebarCollapsed: boolean;
}

/** 장면의 어노테이션을 번호 순으로 정렬해 반환 — 뷰어/편집기 공통 표시 순서. */
export function annotationsOf(scene: Scene, all: Annotation[]): Annotation[] {
  return all
    .filter((a) => a.sceneId === scene.id)
    .sort((a, b) => a.number - b.number);
}

export function orderedScenes(project: SpecProject): Scene[] {
  return [...project.scenes].sort((a, b) => a.order - b.order);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function markdownToHtml(markdown: string): string {
  return escapeHtml(markdown)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function decodeBase64Utf8(base64: string): string {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function readEmbeddedSpec(doc: Document): SpecProject {
  const el = doc.getElementById("spec-data");
  if (!el?.textContent) throw new Error("spec-data를 찾을 수 없습니다.");
  return JSON.parse(el.textContent) as SpecProject;
}

export function readEmbeddedSnapshots(doc: Document): Map<string, string> {
  const snapshots = new Map<string, string>();
  for (const el of Array.from(doc.querySelectorAll<HTMLScriptElement>("script[data-snapshot]"))) {
    const sceneId = el.dataset.snapshot;
    if (!sceneId) continue;
    snapshots.set(sceneId, decodeBase64Utf8(el.textContent ?? ""));
  }
  return snapshots;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function textSignature(el: Element): string {
  return normalizeText(el.textContent).slice(0, 40);
}

function signatureMatches(el: Element, anchor: Anchor): boolean {
  if (anchor.text != null && textSignature(el) !== anchor.text) return false;
  if (anchor.attrs) {
    for (const [key, value] of Object.entries(anchor.attrs)) {
      if (el.getAttribute(key) !== value) return false;
    }
  }
  return true;
}

function escapeSelectorId(id: string): string {
  const css = globalThis.CSS as { escape?: (value: string) => string } | undefined;
  if (css?.escape) return css.escape(id);
  return id.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function isUnique(doc: Document, selector: string): boolean {
  try {
    return doc.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}

function nthOfType(el: Element): number {
  let n = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === el.tagName) n += 1;
    sibling = sibling.previousElementSibling;
  }
  return n;
}

function selectorSegment(el: Element): string {
  return `${el.tagName.toLowerCase()}:nth-of-type(${nthOfType(el)})`;
}

function chainFrom(base: Element | null, el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== base && current.tagName.toLowerCase() !== "html") {
    parts.unshift(selectorSegment(current));
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function generateSelector(el: Element): string {
  const doc = el.ownerDocument;
  if (el.id && isUnique(doc, `#${escapeSelectorId(el.id)}`)) return `#${escapeSelectorId(el.id)}`;

  let ancestor = el.parentElement;
  while (ancestor) {
    if (ancestor.id && isUnique(doc, `#${escapeSelectorId(ancestor.id)}`)) {
      const selector = `#${escapeSelectorId(ancestor.id)} > ${chainFrom(ancestor, el)}`;
      if (isUnique(doc, selector)) return selector;
      break;
    }
    ancestor = ancestor.parentElement;
  }

  return `body > ${chainFrom(doc.body, el)}`;
}

function documentRect(el: Element): Anchor["rect"] {
  const win = el.ownerDocument.defaultView;
  const root = el.ownerDocument.documentElement;
  const rect = el.getBoundingClientRect();
  const scrollX = win?.scrollX ?? 0;
  const scrollY = win?.scrollY ?? 0;
  const width = root.scrollWidth || root.clientWidth || 1;
  const height = root.scrollHeight || root.clientHeight || 1;
  return {
    x: (rect.left + scrollX) / width,
    y: (rect.top + scrollY) / height,
    w: rect.width / width,
    h: rect.height / height,
  };
}

function lastSegmentTag(selector: string): string | null {
  const last = selector.split(">").pop()?.trim() ?? "";
  const match = last.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  return match ? match[1].toLowerCase() : null;
}

function center(rect: Anchor["rect"]): { x: number; y: number } {
  return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
}

function refind(anchor: Anchor, doc: Document): Element | null {
  const tag = lastSegmentTag(anchor.selector);
  const pool = Array.from(tag ? doc.getElementsByTagName(tag) : doc.querySelectorAll("*"));

  let candidates = pool;
  if (anchor.text != null) {
    candidates = candidates.filter((el) => textSignature(el) === anchor.text);
  } else if (!anchor.attrs) {
    return null;
  }
  if (anchor.attrs) {
    candidates = candidates.filter((el) =>
      Object.entries(anchor.attrs!).every(([key, value]) => el.getAttribute(key) === value),
    );
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const target = center(anchor.rect);
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const c = center(documentRect(candidate));
    const distance = (c.x - target.x) ** 2 + (c.y - target.y) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function resolveAnchor(anchor: Anchor, doc: Document): ResolveResult {
  let bySelector: Element | null = null;
  try {
    bySelector = doc.querySelector(anchor.selector);
  } catch {
    bySelector = null;
  }
  if (bySelector && signatureMatches(bySelector, anchor)) {
    return { el: bySelector, mode: "selector", selector: anchor.selector };
  }

  const found = refind(anchor, doc);
  if (found) return { el: found, mode: "refind", selector: generateSelector(found) };

  return { el: null, mode: "rect-fallback", selector: anchor.selector };
}

function setText(el: Element, text: string): void {
  el.textContent = text;
}

function child<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
}

function syncActive(root: HTMLElement, id: string | null): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-annotation-id]"))) {
    el.classList.toggle("is-active", id != null && el.dataset.annotationId === id);
  }
  if (id) {
    // 마커 ↔ 목록 상호 하이라이트·스크롤 (detailed-spec §4.1) — 양방향 모두 보이게 한다
    root.querySelector<HTMLElement>(`.ms-annotation[data-annotation-id="${escapeSelectorId(id)}"]`)?.scrollIntoView({
      block: "nearest",
    });
    root.querySelector<HTMLElement>(`.ms-marker[data-annotation-id="${escapeSelectorId(id)}"]`)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }
}

function frameDocument(iframe: HTMLIFrameElement): Document | null {
  try {
    return iframe.contentDocument;
  } catch {
    return null;
  }
}

function renderMarkers(
  scene: Scene,
  annotations: Annotation[],
  iframe: HTMLIFrameElement,
  layer: HTMLElement,
  state: ViewerState,
  root: HTMLElement,
): void {
  const doc = frameDocument(iframe);
  if (!doc) {
    layer.innerHTML = "";
    return;
  }

  const docRoot = doc.documentElement;
  const docBody = doc.body;
  const docWidth = Math.max(docRoot.scrollWidth, docRoot.clientWidth, docBody?.scrollWidth ?? 0, iframe.clientWidth, 1);
  const docHeight = Math.max(docRoot.scrollHeight, docRoot.clientHeight, docBody?.scrollHeight ?? 0, 480);
  // 넓은 데스크톱 캡처(예: 사내 시스템 ~1920px)가 좁은 중앙에 눌려 잘리지 않도록,
  // iframe·마커 레이어를 콘텐츠 자연 너비로 잡는다 → 중앙(.ms-main)이 양방향 스크롤되고
  // 마커는 콘텐츠와 같은 좌표계에 있어 스크롤해도 정확히 정렬된다.
  iframe.style.width = `${docWidth}px`;
  iframe.style.height = `${docHeight}px`;
  layer.style.width = `${docWidth}px`;
  layer.style.height = `${docHeight}px`;
  layer.innerHTML = "";

  for (const annotation of annotationsOf(scene, annotations)) {
    const resolved = resolveAnchor(annotation.anchor, doc);
    let left: number;
    let top: number;
    if (resolved.el) {
      const rect = resolved.el.getBoundingClientRect();
      const win = doc.defaultView;
      left = rect.right + (win?.scrollX ?? 0);
      top = rect.top + (win?.scrollY ?? 0);
    } else {
      left = (annotation.anchor.rect.x + annotation.anchor.rect.w) * docWidth;
      top = annotation.anchor.rect.y * docHeight;
    }
    // 편집기에서 드래그로 옮긴 마커 오프셋(기본 위치 기준 상대값) 동일 적용 — SDK와 대칭
    left += annotation.markerOffset?.dx ?? 0;
    top += annotation.markerOffset?.dy ?? 0;

    const marker = child("button", `ms-marker${resolved.mode === "rect-fallback" ? " is-uncertain" : ""}`);
    marker.type = "button";
    marker.dataset.annotationId = annotation.id;
    marker.style.left = `${Math.max(14, left)}px`;
    marker.style.top = `${Math.max(14, top)}px`;
    marker.title =
      resolved.mode === "rect-fallback"
        ? "요소를 찾지 못해 마지막 위치에 표시됨"
        : annotation.title || "(제목 없음)";
    setText(marker, String(annotation.number));
    marker.addEventListener("click", () => {
      state.activeAnnotationId = annotation.id;
      syncActive(root, annotation.id);
    });
    layer.append(marker);
  }

  syncActive(root, state.activeAnnotationId);
}

function renderAnnotationPanel(
  scene: Scene,
  annotations: Annotation[],
  state: ViewerState,
  root: HTMLElement,
): HTMLElement {
  const panel = child("aside", "ms-panel");
  const title = child("div", "ms-section-title");
  setText(title, "어노테이션");
  panel.append(title);

  const list = child("div", "ms-list");
  const sceneAnnotations = annotationsOf(scene, annotations);
  if (sceneAnnotations.length === 0) {
    const empty = child("div", "ms-empty");
    setText(empty, "이 장면에는 어노테이션이 없습니다.");
    list.append(empty);
  }

  for (const annotation of sceneAnnotations) {
    const item = child("article", "ms-annotation");
    item.dataset.annotationId = annotation.id;
    item.tabIndex = 0;
    item.addEventListener("click", () => {
      state.activeAnnotationId = annotation.id;
      syncActive(root, annotation.id);
    });

    const head = child("div", "ms-annotation-head");
    const number = child("span", "ms-number");
    setText(number, String(annotation.number));
    const annotationTitle = child("span", "ms-annotation-title");
    setText(annotationTitle, annotation.title || "(제목 없음)");
    head.append(number, annotationTitle);

    const description = child("div", "ms-description");
    description.innerHTML = markdownToHtml(annotation.description || "");
    item.append(head, description);

    for (const ref of annotation.policyRefs ?? []) {
      const badge = child("span", "ms-policy");
      setText(badge, ref);
      item.append(badge);
    }

    list.append(item);
  }
  panel.append(list);
  return panel;
}

function renderSidebar(
  scenes: Scene[],
  selectedSceneId: string | null,
  collapsed: boolean,
  onSelect: (sceneId: string) => void,
  onToggle: () => void,
): HTMLElement {
  if (collapsed) {
    // 접힘: 얇은 레일 + 펼치기 버튼만 (중앙을 최대한 넓힌다)
    const rail = child("aside", "ms-sidebar ms-sidebar--collapsed");
    const expand = child("button", "ms-collapse-btn");
    expand.type = "button";
    expand.title = "장면 목록 펼치기";
    setText(expand, "»");
    expand.addEventListener("click", onToggle);
    rail.append(expand);
    return rail;
  }

  const aside = child("aside", "ms-sidebar");
  const head = child("div", "ms-sidebar-head");
  const heading = child("div", "ms-section-title");
  setText(heading, "장면");
  const collapse = child("button", "ms-collapse-btn");
  collapse.type = "button";
  collapse.title = "장면 목록 접기";
  setText(collapse, "«");
  collapse.addEventListener("click", onToggle);
  head.append(heading, collapse);
  aside.append(head);

  for (const scene of scenes) {
    const button = child("button", `ms-scene-button${scene.id === selectedSceneId ? " is-active" : ""}`);
    button.type = "button";
    button.addEventListener("click", () => onSelect(scene.id));

    const code = child("span", "ms-code");
    setText(code, scene.code);
    const title = child("span", "ms-scene-title");
    setText(title, scene.title || "(제목 없음)");
    button.append(code, title);
    aside.append(button);
  }

  return aside;
}

function renderStage(
  scene: Scene,
  project: SpecProject,
  snapshots: Map<string, string>,
  state: ViewerState,
  root: HTMLElement,
  markerRefresh: { current: (() => void) | null },
): HTMLElement {
  markerRefresh.current = null; // 이전 장면의 stale 콜백 제거 (스냅샷 없는 장면 포함)
  const main = child("main", "ms-main");

  const header = child("div", "ms-stage-header");
  const titleGroup = child("div");
  const title = child("h2", "ms-stage-title");
  setText(title, `${scene.code} ${scene.title || "(제목 없음)"}`);
  titleGroup.append(title);
  if (scene.stateNote) {
    const note = child("p", "ms-note");
    setText(note, scene.stateNote);
    titleGroup.append(note);
  }
  const route = child("div", "ms-meta");
  setText(route, scene.route);
  header.append(titleGroup, route);
  main.append(header);

  const snapshotHtml = snapshots.get(scene.id);
  if (!snapshotHtml) {
    const placeholder = child("div", "ms-empty");
    placeholder.innerHTML = `<p class="ms-warning">스냅샷이 없는 장면입니다.</p><p>편집 화면에서 동결 후 다시 내보내세요.</p>`;
    main.append(placeholder);
    return main;
  }

  const wrap = child("div", "ms-stage-wrap");
  const iframe = child("iframe", "ms-frame") as HTMLIFrameElement;
  iframe.setAttribute("sandbox", "allow-same-origin");
  iframe.title = `${scene.code} ${scene.title || project.name} 스냅샷`;
  const layer = child("div", "ms-marker-layer");
  iframe.addEventListener("load", () => {
    renderMarkers(scene, project.annotations, iframe, layer, state, root);
  });
  iframe.srcdoc = snapshotHtml;
  wrap.append(iframe, layer);
  main.append(wrap);

  // resize 재계산은 renderViewer의 단일 리스너가 이 콜백을 호출한다
  // (장면 전환마다 window 리스너를 새로 달면 누적됨)
  markerRefresh.current = () => {
    renderMarkers(scene, project.annotations, iframe, layer, state, root);
  };

  return main;
}

function renderHeader(project: SpecProject, generatedAt: string | null): HTMLElement {
  const header = child("header", "ms-header");
  const title = child("h1", "ms-title");
  setText(title, `${project.name} 기획서`);
  const meta = child("div", "ms-meta");
  const sceneCount = project.scenes.length;
  const annotationCount = project.annotations.length;
  setText(
    meta,
    `생성: ${generatedAt ? formatDate(generatedAt) : "-"} · 장면 ${sceneCount} · 어노테이션 ${annotationCount}`,
  );
  header.append(title, meta);
  return header;
}

export function renderViewer(project: SpecProject, snapshots: Map<string, string>, root: HTMLElement): void {
  const scenes = orderedScenes(project);
  const state: ViewerState = {
    activeAnnotationId: null,
    sidebarCollapsed: false,
    selectedSceneId: scenes[0]?.id ?? null,
  };
  const generatedAt = document.querySelector<HTMLMetaElement>('meta[name="mockspec-generated-at"]')?.content ?? null;

  // 현재 장면의 마커 재계산 콜백. window 리스너는 여기 1개만 등록한다.
  const markerRefresh: { current: (() => void) | null } = { current: null };
  window.addEventListener("resize", () => markerRefresh.current?.());

  const render = (): void => {
    root.innerHTML = "";
    const shell = child("div", "ms-shell");
    shell.append(renderHeader(project, generatedAt));

    if (scenes.length === 0 || !state.selectedSceneId) {
      const empty = child("div", "ms-empty");
      setText(empty, "등록된 장면이 없습니다.");
      shell.append(empty);
      root.append(shell);
      return;
    }

    const selectedScene = scenes.find((scene) => scene.id === state.selectedSceneId) ?? scenes[0]!;
    state.selectedSceneId = selectedScene.id;
    if (state.activeAnnotationId && !project.annotations.some((a) => a.id === state.activeAnnotationId && a.sceneId === selectedScene.id)) {
      state.activeAnnotationId = null;
    }

    // 접힘 시 왼쪽 컬럼을 얇은 레일로 → 중앙 확대 (가로 스크롤 감소). 클래스로 처리해
    // 모바일 미디어쿼리(1단 스택)가 정상 우선하도록 한다 (인라인 스타일 회피).
    const layout = child("div", `ms-layout${state.sidebarCollapsed ? " ms-layout--collapsed" : ""}`);
    layout.append(
      renderSidebar(
        scenes,
        selectedScene.id,
        state.sidebarCollapsed,
        (sceneId) => {
          state.selectedSceneId = sceneId;
          state.activeAnnotationId = null;
          render();
        },
        () => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
          render();
        },
      ),
      renderStage(selectedScene, project, snapshots, state, root, markerRefresh),
      renderAnnotationPanel(selectedScene, project.annotations, state, root),
    );
    shell.append(layout);
    root.append(shell);
    syncActive(root, state.activeAnnotationId);
  };

  render();
}

function renderError(root: HTMLElement, message: string): void {
  const shell = child("div", "ms-shell");
  const empty = child("div", "ms-empty");
  setText(empty, message);
  shell.append(empty);
  root.replaceChildren(shell);
}

function bootstrap(): void {
  const root = document.getElementById("app");
  if (!(root instanceof HTMLElement)) return;
  try {
    renderViewer(readEmbeddedSpec(document), readEmbeddedSnapshots(document), root);
  } catch (err) {
    renderError(root, err instanceof Error ? err.message : "뷰어를 초기화하지 못했습니다.");
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
}
