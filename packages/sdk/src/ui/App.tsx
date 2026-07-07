import { useEffect, useRef, useState } from "preact/hooks";

/**
 * SDK 셸 (T4): FAB → 편집 패널, 미리보기/편집 모드 토글, Shadow DOM 격리.
 * 어노테이션 부착·앵커·마커는 T5, 장면·동결은 T6에서 이 셸에 얹는다.
 *
 * 모드 의미 (킥오프 §6.1):
 *  - preview: 목업이 원래대로 동작 (SDK가 개입하지 않음)
 *  - edit:    목업 클릭을 capture 단계에서 차단하고 요소를 하이라이트
 */

type Mode = "preview" | "edit";

interface Rect { top: number; left: number; width: number; height: number; }

export function App({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [hover, setHover] = useState<Rect | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // 패널 도킹 시 목업 레이아웃을 360px 축소 (킥오프 §6.1)
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.marginRight;
    el.style.transition = "margin-right .15s ease";
    el.style.marginRight = open ? "360px" : "";
    return () => { el.style.marginRight = prev; };
  }, [open]);

  // 단축키 Alt+Shift+E: 닫혀 있으면 편집으로 열고, 열려 있으면 모드 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        if (!open) { setOpen(true); setMode("edit"); }
        else setMode((m) => (m === "edit" ? "preview" : "edit"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 편집 모드에서만: 목업 클릭 차단 + 요소 하이라이트
  useEffect(() => {
    if (!open || mode !== "edit") { setHover(null); return; }

    const isOwn = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("[data-mockspec-root]");

    const onClickCapture = (e: MouseEvent) => {
      if (isOwn(e.target)) return;          // 패널 자신의 클릭은 통과
      e.preventDefault();
      e.stopPropagation();
      // 어노테이션 생성은 T5. 지금은 목업 조작만 차단.
    };
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || isOwn(el)) { setHover(null); return; }
      const r = el.getBoundingClientRect();
      setHover({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("mousemove", onMove, true);
    return () => {
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("mousemove", onMove, true);
      setHover(null);
    };
  }, [open, mode]);

  if (!open) {
    return (
      <button class="fab" title="mockspec 편집 (Alt+Shift+E)" onClick={() => { setOpen(true); setMode("edit"); }}>
        ✎
      </button>
    );
  }

  return (
    <>
      {mode === "edit" && hover && (
        <div class="hl" style={{ top: hover.top, left: hover.left, width: hover.width, height: hover.height }} />
      )}
      <div class="panel" role="complementary" aria-label="mockspec 편집 패널">
        <div class="panel__head">
          <span class="panel__title">mockspec</span>
          <span class="panel__pid">{projectId}</span>
          <span class="panel__spacer" />
          <span class="status">{mode === "edit" ? "편집 중" : "미리보기"}</span>
          <button class="panel__close" title="닫기" onClick={() => setOpen(false)}>×</button>
        </div>

        <div class="seg" role="tablist">
          <button class={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>미리보기</button>
          <button class={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>편집</button>
        </div>

        <div class="hint">
          {mode === "edit"
            ? "요소 위에 마우스를 올리면 하이라이트됩니다. 목업을 실제로 조작하려면 미리보기로 전환하세요."
            : "목업이 원래대로 동작합니다. 어노테이션을 달려면 편집으로 전환하세요."}
        </div>

        <div class="section">
          <h4>장면</h4>
          <div class="muted">장면 등록·목록은 다음 단계(T5·T6)에서 제공됩니다.</div>
        </div>
        <div class="section">
          <h4>저장</h4>
          <div class="muted">자동 저장은 T7에서 연결됩니다.</div>
        </div>
      </div>
    </>
  );
}
