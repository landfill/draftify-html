import type { Anchor } from "@mockspec/shared";

/**
 * 앵커 생성·재해석 (technical-spec §4, ID-06/07/08). sdk·viewer가 공유하는 순수 로직.
 * DOM 전역에 의존하지 않도록 Document/Element만 받는다 (테스트 용이).
 */

/** 부착 대상으로 삼는 인터랙티브 요소 셀렉터 (ID-08). */
const INTERACTIVE =
  "a, button, input, select, textarea, label, [role=button], [role=link], [role=tab], [onclick], [tabindex]";

/** 시그니처로 수집하는 속성 (존재하는 것만). */
const SIGNATURE_ATTRS = ["aria-label", "role", "name", "type", "placeholder", "alt"];

/** 클릭 지점에서 가장 가까운 인터랙티브 조상. 없으면 그 요소 그대로. (ID-08) */
export function pickTarget(el: Element): Element {
  return el.closest(INTERACTIVE) ?? el;
}

function escapeId(id: string): string {
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (g.CSS?.escape) return g.CSS.escape(id);
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
  let sib = el.previousElementSibling;
  while (sib) {
    if (sib.tagName === el.tagName) n++;
    sib = sib.previousElementSibling;
  }
  return n;
}

function segment(el: Element): string {
  return `${el.tagName.toLowerCase()}:nth-of-type(${nthOfType(el)})`;
}

/** base(제외)에서 el까지의 nth-of-type 체인. base=null이면 el의 문서 최상위까지. */
function chainFrom(base: Element | null, el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== base && cur.tagName.toLowerCase() !== "html") {
    parts.unshift(segment(cur));
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

/** 구조적 셀렉터 생성 (ID-06): 유일 id 기준점 + nth-of-type 체인, 클래스 미사용. */
export function generateSelector(el: Element): string {
  const doc = el.ownerDocument;

  // 1. 요소 자신이 유일 id
  if (el.id && isUnique(doc, `#${escapeId(el.id)}`)) return `#${escapeId(el.id)}`;

  // 2. 유일 id를 가진 가장 가까운 조상을 기준점으로
  let anc: Element | null = el.parentElement;
  while (anc) {
    if (anc.id && isUnique(doc, `#${escapeId(anc.id)}`)) {
      const sel = `#${escapeId(anc.id)} > ${chainFrom(anc, el)}`;
      if (isUnique(doc, sel)) return sel;
      break;
    }
    anc = anc.parentElement;
  }

  // 3. body 기준 전체 경로
  const full = `body > ${chainFrom(doc.body, el)}`;
  return full;
}

function normalizeText(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

/** 요소 textContent 앞 40자(정규화). 시그니처·재탐색 공통. */
export function textSignature(el: Element): string {
  return normalizeText(el.textContent).slice(0, 40);
}

function collectAttrs(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const name of SIGNATURE_ATTRS) {
    const v = el.getAttribute(name);
    if (v != null) attrs[name] = v;
  }
  return attrs;
}

/**
 * rect 비율의 분모로 쓰는 문서 스크롤 크기 — 편집 패널의 스크롤 스페이서(이슈 #8,
 * [data-mockspec-scroll-spacer])는 제외한다. 스페이서는 패널이 문서 오른쪽 끝을
 * 가리지 않게 스크롤 범위만 늘리는 불가시 요소라 콘텐츠 크기가 아니고, 스냅샷(뷰어)
 * 에는 캡처 제외로 존재하지 않는다 — 빼지 않으면 편집·산출물 간 분모가 어긋난다.
 */
export function contentScrollSize(doc: Document): { width: number; height: number } {
  const root = doc.documentElement;
  const height = root.scrollHeight;
  const spacer = doc.querySelector<HTMLElement>("[data-mockspec-scroll-spacer]");
  if (spacer) {
    // 콘텐츠가 스페이서보다 더 자랐으면 scrollWidth가 실제 콘텐츠 폭이다.
    if (root.scrollWidth > spacer.offsetWidth) return { width: root.scrollWidth, height };
    // body가 static이면 스페이서(absolute, 컨테이닝 블록=뷰포트)는 body.scrollWidth에
    // 안 잡히므로 실시간 측정이 가능하다 — 스페이서 설치 후 콘텐츠가 변해도 분모가
    // 낡지 않는다. body가 positioned면 스페이서가 섞여 측정되므로 설치 시점 실측값 사용.
    const live = doc.defaultView?.getComputedStyle(doc.body).position === "static"
      ? doc.body.scrollWidth : 0;
    const stored = Number(spacer.getAttribute("data-content-width")) || 0;
    return { width: Math.max(live || stored, root.clientWidth), height };
  }
  return { width: root.scrollWidth, height };
}

function documentRect(el: Element): Anchor["rect"] {
  const win = el.ownerDocument.defaultView;
  const r = el.getBoundingClientRect();
  const sx = win?.scrollX ?? 0;
  const sy = win?.scrollY ?? 0;
  const size = contentScrollSize(el.ownerDocument);
  const sw = size.width || 1;
  const sh = size.height || 1;
  return { x: (r.left + sx) / sw, y: (r.top + sy) / sh, w: r.width / sw, h: r.height / sh };
}

/** 요소에서 앵커 생성 (selector + text + attrs + rect). */
export function generateAnchor(el: Element): Anchor {
  const text = textSignature(el);
  const attrs = collectAttrs(el);
  const anchor: Anchor = { selector: generateSelector(el), rect: documentRect(el) };
  if (text) anchor.text = text;
  if (Object.keys(attrs).length > 0) anchor.attrs = attrs;
  return anchor;
}

function signatureMatches(el: Element, anchor: Anchor): boolean {
  if (anchor.text != null && textSignature(el) !== anchor.text) return false;
  if (anchor.attrs) {
    for (const [k, v] of Object.entries(anchor.attrs)) {
      if (el.getAttribute(k) !== v) return false;
    }
  }
  return true;
}

/** anchor.selector의 마지막 세그먼트에서 tagName 추출. 없으면 null(전체 스캔). */
function lastSegmentTag(selector: string): string | null {
  const last = selector.split(">").pop()!.trim();
  const m = last.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  return m ? m[1].toLowerCase() : null;
}

function centerRatio(rect: Anchor["rect"]): { cx: number; cy: number } {
  return { cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
}

/** 재탐색 (ID-07): text/attrs 시그니처로 후보를 좁히고 rect 최근접으로 확정. */
function refind(anchor: Anchor, doc: Document): Element | null {
  const tag = lastSegmentTag(anchor.selector);
  const pool = Array.from(tag ? doc.getElementsByTagName(tag) : doc.querySelectorAll("*"));

  let candidates = pool;
  if (anchor.text != null) {
    candidates = candidates.filter((el) => textSignature(el) === anchor.text);
  } else if (!anchor.attrs) {
    return null; // text·attrs 둘 다 없으면 재탐색 불가 (정상 — rect fallback)
  }
  if (anchor.attrs) {
    candidates = candidates.filter((el) =>
      Object.entries(anchor.attrs!).every(([k, v]) => el.getAttribute(k) === v),
    );
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // 여러 개 → rect 중심점 최근접
  const { cx, cy } = centerRatio(anchor.rect);
  let best = candidates[0];
  let bestD = Infinity;
  for (const el of candidates) {
    const c = centerRatio(documentRect(el));
    const d = (c.cx - cx) ** 2 + (c.cy - cy) ** 2;
    if (d < bestD) { bestD = d; best = el; }
  }
  return best;
}

export type ResolveMode = "selector" | "refind" | "selector-mismatch" | "rect-fallback";

export interface ResolveResult {
  el: Element | null;
  mode: ResolveMode;
  /** refind로 요소를 찾았을 때 갱신된 셀렉터 (저장 대상). 그 외에는 원본 유지. */
  selector: string;
}

/**
 * 재해석 (ID-07): selector → 시그니처 검증 → 실패 시 재탐색(+selector 자동 갱신)
 * → selector 유일 해석(서명 불일치, 위치 불확실 표시 — 킥오프 §11 15차) → rect fallback.
 * 마커를 조용히 사라지게 두지 않는다: 실패 시 el=null, mode="rect-fallback"로 위치 불확실 표시.
 */
export function resolveAnchor(anchor: Anchor, doc: Document): ResolveResult {
  let bySelector: Element | null = null;
  let selectorUnique = false;
  try {
    const matched = doc.querySelectorAll(anchor.selector);
    bySelector = matched[0] ?? null;
    selectorUnique = matched.length === 1;
  } catch {
    bySelector = null;
  }
  if (bySelector && signatureMatches(bySelector, anchor)) {
    return { el: bySelector, mode: "selector", selector: anchor.selector };
  }

  const found = refind(anchor, doc);
  if (found) {
    return { el: found, mode: "refind", selector: generateSelector(found) };
  }

  // 동적 텍스트(타이머·랜덤 문구)로 서명만 불일치한 경우: 유일 해석되는 selector의
  // 요소가 마지막 rect(다른 레이아웃에서 측정됐을 수 있음)보다 신뢰할 만하다.
  // 서명 불일치 상태이므로 selector 갱신·저장은 하지 않는다.
  if (bySelector && selectorUnique) {
    return { el: bySelector, mode: "selector-mismatch", selector: anchor.selector };
  }

  return { el: null, mode: "rect-fallback", selector: anchor.selector };
}
