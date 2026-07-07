import { useEffect, useRef, useState } from "preact/hooks";
import { pickTarget, generateAnchor } from "../anchor/anchor.js";
import {
  emptyDoc, createScene, deleteScene, addAnnotation, updateAnnotation,
  deleteAnnotation, annotationsOfScene, updateAnchorSelector, type EditorDoc,
} from "../state.js";
import { useMarkers } from "./useMarkers.js";

/**
 * SDK 편집기 (T5): 장면(그릇) + 어노테이션 부착 + 앵커/마커.
 * 동결(스냅샷)은 T6, 서버 저장·오프라인 큐는 T7에서 얹는다 — 현재 상태는 인메모리.
 */

type Mode = "preview" | "edit";
interface Rect { top: number; left: number; width: number; height: number; }

export function App({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [hover, setHover] = useState<Rect | null>(null);
  const [doc, setDoc] = useState<EditorDoc>(emptyDoc());
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [selectedAnn, setSelectedAnn] = useState<string | null>(null);
  const [needScene, setNeedScene] = useState(false);

  // 옵저버/전역 리스너가 최신 상태를 읽도록 ref 래핑
  const docRef = useRef(doc); docRef.current = doc;
  const sceneRef = useRef(currentSceneId); sceneRef.current = currentSceneId;
  const modeRef = useRef(mode); modeRef.current = mode;
  const getDoc = useRef(() => docRef.current).current;
  const onSelectorUpdate = useRef((annId: string, selector: string) => {
    setDoc((d) => updateAnchorSelector(d, annId, selector));
  }).current;

  const annSignature = currentSceneId
    ? annotationsOfScene(doc, currentSceneId).map((a) => `${a.id}:${a.anchor.selector}`).join(",")
    : "";
  const markers = useMarkers(getDoc, currentSceneId, open, onSelectorUpdate, annSignature);

  // 패널 도킹 시 목업 레이아웃 360px 축소
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.marginRight;
    el.style.transition = "margin-right .15s ease";
    el.style.marginRight = open ? "360px" : "";
    return () => { el.style.marginRight = prev; };
  }, [open]);

  // 단축키 Alt+Shift+E
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

  const isOwn = (t: EventTarget | null) =>
    t instanceof Element && !!t.closest("[data-mockspec-root]");

  // 편집 모드: 목업 클릭 차단 + 부착 시퀀스 + 요소 하이라이트
  useEffect(() => {
    if (!open || mode !== "edit") { setHover(null); return; }

    const onClickCapture = (e: MouseEvent) => {
      if (isOwn(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const scene = sceneRef.current;
      if (!scene) { setNeedScene(true); return; }      // 장면 없으면 안내
      const target = pickTarget(e.target as Element);   // ID-08
      const anchor = generateAnchor(target);            // ID-06
      const { doc: nd, annotation } = addAnnotation(docRef.current, scene, anchor);
      setDoc(nd);
      setSelectedAnn(annotation.id);                    // 패널 항목 열고 포커스
    };
    const onMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || isOwn(el)) { setHover(null); return; }
      const t = pickTarget(el);
      const r = t.getBoundingClientRect();
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

  // 새 어노테이션 title 자동 포커스
  useEffect(() => {
    if (!selectedAnn) return;
    const el = document.querySelector("[data-mockspec-root]")?.shadowRoot
      ?.querySelector<HTMLInputElement>(`[data-ann-title="${selectedAnn}"]`);
    el?.focus();
  }, [selectedAnn, doc]);

  const registerScene = () => {
    const title = document.title || "장면";
    const route = location.pathname + location.search + location.hash;
    const { doc: nd, scene } = createScene(doc, { title, route });
    setDoc(nd);
    setCurrentSceneId(scene.id);
    setNeedScene(false);
  };

  const removeScene = (id: string) => {
    const anns = annotationsOfScene(doc, id).length;
    if (!confirm(`이 장면과 어노테이션 ${anns}개가 삭제됩니다.`)) return;
    setDoc(deleteScene(doc, id));
    if (currentSceneId === id) setCurrentSceneId(null);
  };

  if (!open) {
    return (
      <button class="fab" title="mockspec 편집 (Alt+Shift+E)" onClick={() => { setOpen(true); setMode("edit"); }}>✎</button>
    );
  }

  const scene = doc.scenes.find((s) => s.id === currentSceneId) ?? null;
  const anns = scene ? annotationsOfScene(doc, scene.id) : [];

  return (
    <>
      {mode === "edit" && hover && (
        <div class="hl" style={{ top: hover.top, left: hover.left, width: hover.width, height: hover.height }} />
      )}
      {/* 마커: 미리보기·편집 양쪽에서 현재 장면 소속만 렌더 (ID-09) */}
      {markers.map((m) => (
        <button
          key={m.annId}
          class={`marker${m.uncertain ? " marker--uncertain" : ""}${selectedAnn === m.annId ? " marker--sel" : ""}`}
          style={{ left: m.x, top: m.y }}
          title={m.uncertain ? "위치 불확실" : undefined}
          onClick={() => setSelectedAnn(m.annId)}
        >{m.number}</button>
      ))}

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

        <div class="section">
          <div class="row">
            <h4>장면</h4>
            <button class="btn" onClick={registerScene}>+ 현재 화면을 장면으로</button>
          </div>
          {doc.scenes.length === 0 && <div class="muted">아직 장면이 없습니다. 위 버튼으로 현재 화면을 장면으로 등록하세요.</div>}
          <ul class="list">
            {doc.scenes.map((s) => (
              <li key={s.id} class={`scene${s.id === currentSceneId ? " scene--cur" : ""}`}>
                <button class="scene__pick" onClick={() => setCurrentSceneId(s.id)}>
                  <span class="scene__code">{s.code}</span> {s.title || "(제목 없음)"}
                </button>
                <button class="scene__del" title="삭제" onClick={() => removeScene(s.id)}>×</button>
              </li>
            ))}
          </ul>
        </div>

        <div class="section">
          <h4>어노테이션 {scene && `· ${scene.code}`}</h4>
          {!scene && <div class="muted">장면을 선택하면 어노테이션을 달 수 있습니다.</div>}
          {scene && mode !== "edit" && <div class="muted">편집 모드에서 요소를 클릭해 어노테이션을 답니다.</div>}
          {scene && mode === "edit" && anns.length === 0 && (
            <div class={`hint${needScene ? " hint--warn" : ""}`}>요소를 클릭하면 어노테이션이 생성됩니다.</div>
          )}
          {needScene && <div class="hint hint--warn">먼저 장면을 등록해주세요.</div>}
          {anns.map((a) => (
            <div key={a.id} class={`ann${selectedAnn === a.id ? " ann--sel" : ""}`}>
              <div class="row">
                <span class="ann__num">{a.number}</span>
                <input
                  class="ann__title" data-ann-title={a.id} placeholder="제목"
                  value={a.title}
                  onInput={(e) => setDoc(updateAnnotation(doc, a.id, { title: (e.target as HTMLInputElement).value }))}
                />
                <button class="ann__del" title="삭제" onClick={() => setDoc(deleteAnnotation(doc, a.id))}>×</button>
              </div>
              <textarea
                class="ann__desc" placeholder="설명 (마크다운)"
                value={a.description}
                onInput={(e) => setDoc(updateAnnotation(doc, a.id, { description: (e.target as HTMLTextAreaElement).value }))}
              />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
