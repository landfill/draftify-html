import { useEffect, useState } from "preact/hooks";
import { contentScrollSize, resolveAnchor } from "../anchor/anchor.js";
import { annotationsOfScene, type EditorDoc } from "../state.js";

/** 마커 1개의 뷰포트 좌표 (요소 좌상단). uncertain=위치 불확실(서명 불일치·rect fallback). */
export interface MarkerPos {
  annId: string;
  number: number;
  x: number;
  y: number;
  uncertain: boolean;
}

/**
 * 현재 장면 어노테이션들의 마커 위치를 유지한다 (technical-spec §4.3, detailed-spec §3.5).
 * 재해석 트리거: MutationObserver + ResizeObserver 300ms 디바운스, scroll/resize는 즉시.
 * 마커를 조용히 사라지게 두지 않는다: 실패 시 rect fallback 위치에 불확실 표시.
 */
export function useMarkers(
  getDoc: () => EditorDoc,
  sceneId: string | null,
  active: boolean,
  onSelectorUpdate: (annId: string, selector: string) => void,
  /** 현재 장면 어노테이션 집합의 시그니처(id+selector). 바뀌면 즉시 재계산 — 옵저버로는
   *  잡히지 않는 "패널에서의 어노테이션 추가/삭제/셀렉터 갱신"을 반영하기 위함. */
  annSignature: string,
): MarkerPos[] {
  const [markers, setMarkers] = useState<MarkerPos[]>([]);

  useEffect(() => {
    if (!active || !sceneId) {
      setMarkers([]);
      return;
    }

    const recompute = () => {
      const doc = getDoc();
      // rect 비율의 분모 — 스크롤 스페이서(이슈 #8)를 제외한 콘텐츠 크기 (앵커 생성과 동일 기준)
      const size = contentScrollSize(document);
      const next: MarkerPos[] = annotationsOfScene(doc, sceneId).map((a) => {
        const res = resolveAnchor(a.anchor, document);
        if (res.el) {
          if (res.mode === "refind" && res.selector !== a.anchor.selector) {
            onSelectorUpdate(a.id, res.selector); // 갱신된 selector 저장
          }
          const r = res.el.getBoundingClientRect();
          // selector-mismatch: 요소는 찾았지만 서명 불일치 — 그 위치에 위치 불확실로 표시
          return { annId: a.id, number: a.number, x: r.left, y: r.top, uncertain: res.mode === "selector-mismatch" };
        }
        // rect fallback: 문서 비율 → 뷰포트 좌표
        const x = a.anchor.rect.x * size.width - window.scrollX;
        const y = a.anchor.rect.y * size.height - window.scrollY;
        return { annId: a.id, number: a.number, x, y, uncertain: true };
      });
      setMarkers(next);
    };

    let timer: number | undefined;
    const debounced = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(recompute, 300);
    };

    recompute();
    const mo = new MutationObserver(debounced);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    const ro = new ResizeObserver(debounced);
    ro.observe(document.documentElement);
    window.addEventListener("scroll", recompute, true);
    window.addEventListener("resize", recompute);

    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
      ro.disconnect();
      window.removeEventListener("scroll", recompute, true);
      window.removeEventListener("resize", recompute);
    };
    // getDoc·onSelectorUpdate는 안정적 ref 래퍼로 전달됨
  }, [sceneId, active, annSignature]);

  return markers;
}
