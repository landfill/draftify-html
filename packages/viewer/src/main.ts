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
  /** 프로세스 흐름도 섹션 접힘 (output-standard §2 섹션 2) */
  flowCollapsed: boolean;
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

// ---------------------------------------------------------------------------
// 프로세스 흐름도 (output-standard §2 섹션 2 — FR-EXP-06)
// scenes + transitions 방향 그래프를 자체 경량 SVG로 렌더한다.
// Mermaid를 쓰지 않는 이유: 산출물은 단독 HTML·네트워크 0건이라 번들 내장이 필요한데
// ~3MB로 산출물이 상시 비대해진다 (s1-kickoff §11 7차 개정). 사람이 입력한 전이만 그린다.
// ---------------------------------------------------------------------------

export interface FlowEdge {
  from: string;
  to: string;
  /** 같은 (from,to) 병렬 전이의 condition을 " / "로 합친 간선 라벨. 조건이 없으면 "" */
  label: string;
}

export interface FlowNode {
  sceneId: string;
  label: string;
  /** 왼→오 계층 (진입 간선 없는 노드가 0) */
  layer: number;
  /** 계층 내 세로 순서 (장면 order 순) */
  row: number;
}

/**
 * 어노테이션의 transition을 간선 목록으로 정리한다.
 * 양끝 장면이 실재하는 전이만 — 자기 자신으로의 전이(비정상 데이터)와 dangling은 그리지 않는다.
 * 같은 (from,to)의 병렬 전이는 간선 1개로 합치고 condition들을 " / "로 잇는다.
 */
export function buildFlowEdges(project: SpecProject): FlowEdge[] {
  const sceneIds = new Set(project.scenes.map((s) => s.id));
  const merged = new Map<string, { from: string; to: string; conditions: string[] }>();
  for (const a of project.annotations) {
    const t = a.transition;
    if (!t || t.toSceneId === a.sceneId) continue;
    if (!sceneIds.has(a.sceneId) || !sceneIds.has(t.toSceneId)) continue;
    const key = `${a.sceneId} ${t.toSceneId}`;
    const entry = merged.get(key) ?? { from: a.sceneId, to: t.toSceneId, conditions: [] };
    const condition = t.condition?.trim();
    if (condition) entry.conditions.push(condition);
    merged.set(key, entry);
  }
  return [...merged.values()].map((e) => ({ from: e.from, to: e.to, label: e.conditions.join(" / ") }));
}

/**
 * 계층 배치: DFS(장면 order 순 진입)로 순환을 이루는 back 간선을 제외한 뒤,
 * 위상 순서로 longest-path 계층을 매긴다. 순환은 배치에서만 무시되고 간선은 그려진다.
 */
export function buildFlowNodes(project: SpecProject, edges: FlowEdge[]): FlowNode[] {
  const scenes = orderedScenes(project);
  const out = new Map<string, string[]>();
  for (const s of scenes) out.set(s.id, []);
  for (const e of edges) out.get(e.from)?.push(e.to);

  // DFS로 back 간선 판정 + 위상 순서(후위 역순) 수집
  const state = new Map<string, 0 | 1 | 2>(); // 0=미방문 1=스택 위 2=완료
  const acyclic = new Map<string, string[]>();
  const topo: string[] = [];
  const visit = (id: string): void => {
    state.set(id, 1);
    const forward: string[] = [];
    for (const next of out.get(id) ?? []) {
      if (state.get(next) === 1) continue; // back 간선 — 계층 계산에서 제외
      forward.push(next);
      if (!state.get(next)) visit(next);
    }
    acyclic.set(id, forward);
    state.set(id, 2);
    topo.push(id);
  };
  for (const s of scenes) if (!state.get(s.id)) visit(s.id);
  topo.reverse();

  const layer = new Map<string, number>();
  for (const s of scenes) layer.set(s.id, 0);
  for (const id of topo) {
    const base = layer.get(id) ?? 0;
    for (const next of acyclic.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, base + 1));
    }
  }

  const rowCount = new Map<number, number>();
  return scenes.map((s) => {
    const l = layer.get(s.id) ?? 0;
    const row = rowCount.get(l) ?? 0;
    rowCount.set(l, row + 1);
    return { sceneId: s.id, label: `${s.code} ${s.title || "(제목 없음)"}`, layer: l, row };
  });
}

const FLOW_NODE_H = 34;
const FLOW_GAP_X = 72;
const FLOW_GAP_Y = 16;
const FLOW_PAD = 10;
const FLOW_LABEL_MAX = 30;

function truncateLabel(label: string): string {
  return label.length > FLOW_LABEL_MAX ? `${label.slice(0, FLOW_LABEL_MAX - 1)}…` : label;
}

/** 폭 추정 (12px 폰트 기준) — CJK는 전각, 그 외 반각. 정확할 필요 없이 잘리지만 않으면 된다. */
function estimateTextWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += ch.charCodeAt(0) > 0x2e80 ? 12 : 7;
  return width;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

/** 흐름도 SVG 렌더. 전이가 하나도 없으면 null — 섹션 자체를 생략한다 (추론으로 채우지 않음). */
function renderFlowSvg(
  project: SpecProject,
  selectedSceneId: string | null,
  onSelectScene: (sceneId: string) => void,
): SVGSVGElement | null {
  const edges = buildFlowEdges(project);
  if (edges.length === 0) return null;
  const nodes = buildFlowNodes(project, edges);

  const nodeW = Math.min(
    300,
    Math.max(140, ...nodes.map((n) => estimateTextWidth(truncateLabel(n.label)) + 24)),
  );
  const pos = new Map<string, { x: number; y: number }>();
  let maxLayer = 0;
  let maxRow = 0;
  for (const n of nodes) {
    pos.set(n.sceneId, {
      x: FLOW_PAD + n.layer * (nodeW + FLOW_GAP_X),
      y: FLOW_PAD + n.row * (FLOW_NODE_H + FLOW_GAP_Y),
    });
    maxLayer = Math.max(maxLayer, n.layer);
    maxRow = Math.max(maxRow, n.row);
  }
  const width = FLOW_PAD * 2 + (maxLayer + 1) * nodeW + maxLayer * FLOW_GAP_X;
  const height = FLOW_PAD * 2 + (maxRow + 1) * FLOW_NODE_H + maxRow * FLOW_GAP_Y;

  const svg = svgEl("svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "프로세스 흐름도");

  const defs = svgEl("defs");
  const marker = svgEl("marker");
  marker.setAttribute("id", "ms-flow-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = svgEl("path");
  arrow.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrow.setAttribute("fill", "#5f6368");
  marker.append(arrow);
  defs.append(marker);
  svg.append(defs);

  for (const edge of edges) {
    const from = pos.get(edge.from);
    const to = pos.get(edge.to);
    if (!from || !to) continue;
    const forward = to.x > from.x;
    // 정방향: 출발 오른쪽 중앙 → 도착 왼쪽 중앙. 역방향(순환)은 아래로 우회.
    const x1 = forward ? from.x + nodeW : from.x + nodeW / 2;
    const y1 = forward ? from.y + FLOW_NODE_H / 2 : from.y + FLOW_NODE_H;
    const x2 = forward ? to.x : to.x + nodeW / 2;
    const y2 = forward ? to.y + FLOW_NODE_H / 2 : to.y + FLOW_NODE_H;
    const path = svgEl("path");
    const bend = forward ? Math.max(28, (x2 - x1) / 2) : 46;
    const c1x = forward ? x1 + bend : x1 + 20;
    const c1y = forward ? y1 : y1 + bend;
    const c2x = forward ? x2 - bend : x2 - 20;
    const c2y = forward ? y2 : y2 + bend;
    path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
    path.setAttribute("class", "ms-flow-edge");
    path.setAttribute("marker-end", "url(#ms-flow-arrow)");
    svg.append(path);

    if (edge.label) {
      // 3차 베지어 t=0.5 지점 = (P0 + 3·C1 + 3·C2 + P3) / 8
      const mx = (x1 + 3 * c1x + 3 * c2x + x2) / 8;
      const my = (y1 + 3 * c1y + 3 * c2y + y2) / 8;
      const label = svgEl("text");
      label.setAttribute("x", String(mx));
      label.setAttribute("y", String(my - 5));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "ms-flow-label");
      label.textContent = truncateLabel(edge.label);
      svg.append(label);
    }
  }

  for (const node of nodes) {
    const p = pos.get(node.sceneId)!;
    const g = svgEl("g");
    g.setAttribute("class", `ms-flow-node${node.sceneId === selectedSceneId ? " is-active" : ""}`);
    g.setAttribute("data-scene-id", node.sceneId);
    const rect = svgEl("rect");
    rect.setAttribute("x", String(p.x));
    rect.setAttribute("y", String(p.y));
    rect.setAttribute("width", String(nodeW));
    rect.setAttribute("height", String(FLOW_NODE_H));
    rect.setAttribute("rx", "8");
    const text = svgEl("text");
    text.setAttribute("x", String(p.x + nodeW / 2));
    text.setAttribute("y", String(p.y + FLOW_NODE_H / 2 + 4));
    text.setAttribute("text-anchor", "middle");
    text.textContent = truncateLabel(node.label);
    const title = svgEl("title");
    title.textContent = `${node.label} — 클릭하면 이 장면으로 이동`;
    g.append(title, rect, text);
    g.addEventListener("click", () => onSelectScene(node.sceneId));
    svg.append(g);
  }

  return svg;
}

/** 흐름도 섹션 (접기 토글 포함). 전이가 없으면 null — 렌더하지 않는다. */
function renderFlowSection(
  project: SpecProject,
  state: ViewerState,
  onSelectScene: (sceneId: string) => void,
  onToggle: () => void,
): HTMLElement | null {
  const svg = renderFlowSvg(project, state.selectedSceneId, onSelectScene);
  if (!svg) return null;

  const section = child("section", "ms-flow");
  const head = child("div", "ms-flow-head");
  const title = child("div", "ms-section-title");
  setText(title, "프로세스 흐름도");
  const toggle = child("button", "ms-collapse-btn");
  toggle.type = "button";
  toggle.title = state.flowCollapsed ? "흐름도 펼치기" : "흐름도 접기";
  setText(toggle, state.flowCollapsed ? "▸" : "▾");
  toggle.addEventListener("click", onToggle);
  head.append(title, toggle);
  section.append(head);

  if (!state.flowCollapsed) {
    const body = child("div", "ms-flow-body");
    body.append(svg);
    section.append(body);
  }
  return section;
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
  scenes: Scene[],
  state: ViewerState,
  root: HTMLElement,
  onSelectScene: (sceneId: string) => void,
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

    // 전이 링크 — 클릭 시 해당 장면으로 전환 (실행 대신 이동, detailed-spec §4.1).
    // 대상 장면이 없으면(비정상 데이터) 표시하지 않는다.
    const transition = annotation.transition;
    const target = transition ? scenes.find((s) => s.id === transition.toSceneId) : undefined;
    if (transition && target) {
      const link = child("button", "ms-transition");
      link.type = "button";
      const condition = transition.condition?.trim();
      setText(link, `${condition ? `${condition} ` : ""}→ ${target.code} ${target.title || "(제목 없음)"} 보기`);
      link.addEventListener("click", (event) => {
        event.stopPropagation(); // 카드 클릭(하이라이트)과 분리
        onSelectScene(target.id);
      });
      item.append(link);
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
    flowCollapsed: false,
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

    const onSelectScene = (sceneId: string): void => {
      state.selectedSceneId = sceneId;
      state.activeAnnotationId = null;
      render();
    };

    // 섹션 2: 프로세스 흐름도 — 전이가 있을 때만 (output-standard §2)
    const flow = renderFlowSection(project, state, onSelectScene, () => {
      state.flowCollapsed = !state.flowCollapsed;
      render();
    });
    if (flow) shell.append(flow);

    // 접힘 시 왼쪽 컬럼을 얇은 레일로 → 중앙 확대 (가로 스크롤 감소). 클래스로 처리해
    // 모바일 미디어쿼리(1단 스택)가 정상 우선하도록 한다 (인라인 스타일 회피).
    const layout = child("div", `ms-layout${state.sidebarCollapsed ? " ms-layout--collapsed" : ""}`);
    layout.append(
      renderSidebar(
        scenes,
        selectedScene.id,
        state.sidebarCollapsed,
        onSelectScene,
        () => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
          render();
        },
      ),
      renderStage(selectedScene, project, snapshots, state, root, markerRefresh),
      renderAnnotationPanel(selectedScene, project.annotations, scenes, state, root, onSelectScene),
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
