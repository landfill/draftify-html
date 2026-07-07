import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { SpecProject } from "@mockspec/shared";
import { pickTarget, generateAnchor } from "../anchor/anchor.js";
import {
  emptyDoc, createScene, deleteScene, addAnnotation, updateAnnotation,
  deleteAnnotation, annotationsOfScene, updateAnchorSelector, setSceneSnapshot,
  docFromProject, applyDocToProject, projectContentSignature,
  type EditorDoc,
} from "../state.js";
import { freezeDocument } from "../freeze/freeze.js";
import {
  fetchProject,
  flushPendingProject,
  readPendingProject,
  saveProjectWithQueue,
  uploadSnapshot,
} from "../api.js";
import { useMarkers } from "./useMarkers.js";

/**
 * SDK 편집기: 장면(그릇) + 어노테이션 부착 + 앵커/마커 + 장면 동결 + 저장.
 * 장면 등록 시 현재 DOM을 즉시 동결(single-file-core)해 스냅샷을 업로드한다.
 * 편집 상태는 500ms 디바운스로 전체 SpecProject PUT, 실패 시 최신본 1개를 localStorage에 둔다.
 */

type Mode = "preview" | "edit";
type SaveStatus = "loading" | "saved" | "saving" | "offline" | "error";
interface Rect { top: number; left: number; width: number; height: number; }

function saveStatusLabel(status: SaveStatus): string {
  if (status === "saved") return "저장됨 ✓";
  if (status === "saving") return "저장 중…";
  if (status === "offline") return "오프라인 — 로컬 보관 중";
  if (status === "error") return "불러오기 실패";
  return "불러오는 중…";
}

function firstSceneId(project: SpecProject): string | null {
  return project.scenes[0]?.id ?? null;
}

export function App({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("edit");
  const [hover, setHover] = useState<Rect | null>(null);
  const [project, setProject] = useState<SpecProject | null>(null);
  const [doc, setDoc] = useState<EditorDoc>(emptyDoc());
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [selectedAnn, setSelectedAnn] = useState<string | null>(null);
  const [needScene, setNeedScene] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  // 동결 진행/실패 상태 (성공은 scene.snapshotAsset로 표현). sceneId → 값.
  const [freezing, setFreezing] = useState<Record<string, boolean>>({});
  const [freezeErr, setFreezeErr] = useState<Record<string, string>>({});

  // 옵저버/전역 리스너가 최신 상태를 읽도록 ref 래핑
  const projectRef = useRef(project); projectRef.current = project;
  const docRef = useRef(doc); docRef.current = doc;
  const sceneRef = useRef(currentSceneId); sceneRef.current = currentSceneId;
  const modeRef = useRef(mode); modeRef.current = mode;
  const lastSyncedRef = useRef<string | null>(null);
  const flushingRef = useRef(false);
  const getDoc = useRef(() => docRef.current).current;
  const onSelectorUpdate = useRef((annId: string, selector: string) => {
    setDoc((d) => updateAnchorSelector(d, annId, selector));
  }).current;

  const annSignature = currentSceneId
    ? annotationsOfScene(doc, currentSceneId).map((a) => `${a.id}:${a.anchor.selector}`).join(",")
    : "";
  const markers = useMarkers(getDoc, currentSceneId, open, onSelectorUpdate, annSignature);

  // SDK 초기 로드: pending이 있으면 로컬 우선으로 즉시 표시하고 PUT을 먼저 시도(ID-05).
  useEffect(() => {
    let cancelled = false;

    const applyLoadedProject = (next: SpecProject, status: SaveStatus) => {
      lastSyncedRef.current = projectContentSignature(next);
      setLoadError(null);
      setProject(next);
      setDoc(docFromProject(next));
      setCurrentSceneId(firstSceneId(next));
      setSaveStatus(status);
    };

    const boot = async () => {
      const pending = readPendingProject(projectId);
      if (pending) {
        if (!cancelled) applyLoadedProject(pending, "saving");
        try {
          const saved = await flushPendingProject(projectId);
          if (!cancelled && saved) applyLoadedProject(saved, "saved");
        } catch (err) {
          if (!cancelled) {
            setSaveStatus("offline");
            console.warn("[mockspec] pending spec 재전송 실패:", err);
          }
        }
        return;
      }

      try {
        const remote = await fetchProject(projectId);
        if (!cancelled) applyLoadedProject(remote, "saved");
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "프로젝트 불러오기 실패";
          setLoadError(message);
          setSaveStatus("error");
          console.warn("[mockspec] 프로젝트 불러오기 실패:", err);
        }
      }
    };

    void boot();
    return () => { cancelled = true; };
  }, [projectId]);

  const currentProjectSnapshot = useCallback((): SpecProject | null => {
    const base = projectRef.current;
    if (!base) return null;
    return applyDocToProject(base, docRef.current);
  }, []);

  const flushQueued = useCallback(async () => {
    if (flushingRef.current) return;
    const pending = readPendingProject(projectId);
    if (!pending) return;

    flushingRef.current = true;
    setSaveStatus("saving");
    const pendingSignature = projectContentSignature(pending);
    try {
      const saved = await flushPendingProject(projectId);
      if (!saved) return;
      const savedSignature = projectContentSignature(saved);
      lastSyncedRef.current = savedSignature;

      const current = currentProjectSnapshot();
      const currentSignature = current ? projectContentSignature(current) : null;
      setProject(saved);

      if (!currentSignature || currentSignature === pendingSignature) {
        setDoc(docFromProject(saved));
        setCurrentSceneId((id) => saved.scenes.some((s) => s.id === id) ? id : firstSceneId(saved));
        setSaveStatus("saved");
      } else {
        // 로컬에서 더 새 변경이 이미 생겼으면 다음 디바운스 저장이 이어받는다.
        setSaveStatus("saving");
      }
    } catch (err) {
      setSaveStatus("offline");
      console.warn("[mockspec] pending spec 재전송 실패:", err);
    } finally {
      flushingRef.current = false;
    }
  }, [currentProjectSnapshot, projectId]);

  // online 이벤트와 서버 재기동 케이스를 모두 커버: pending이 있으면 짧게 재시도한다.
  useEffect(() => {
    const onOnline = () => { void flushQueued(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushQueued]);

  useEffect(() => {
    if (saveStatus !== "offline") return;
    const timer = window.setInterval(() => { void flushQueued(); }, 2000);
    return () => window.clearInterval(timer);
  }, [flushQueued, saveStatus]);

  // 편집 변경 저장: 500ms 디바운스 + 전체 SpecProject PUT + 실패 시 최신본 1개 큐.
  useEffect(() => {
    if (!project || loadError) return;
    const next = applyDocToProject(project, doc);
    const nextSignature = projectContentSignature(next);
    if (nextSignature === lastSyncedRef.current) return;

    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      const snapshot = currentProjectSnapshot();
      if (!snapshot) return;
      const sentSignature = projectContentSignature(snapshot);

      void saveProjectWithQueue(snapshot).then((result) => {
        if (result.queued) {
          const current = currentProjectSnapshot();
          if (!current || projectContentSignature(current) === sentSignature) {
            setSaveStatus("offline");
          }
          console.warn("[mockspec] 저장 실패, localStorage 큐에 보관:", result.error);
          return;
        }

        const saved = result.project;
        const savedSignature = projectContentSignature(saved);
        lastSyncedRef.current = savedSignature;
        const current = currentProjectSnapshot();
        const currentSignature = current ? projectContentSignature(current) : null;
        setProject(saved);

        if (!currentSignature || currentSignature === sentSignature) {
          setDoc(docFromProject(saved));
          setCurrentSceneId((id) => saved.scenes.some((s) => s.id === id) ? id : firstSceneId(saved));
          setSaveStatus("saved");
        } else {
          setSaveStatus("saving");
        }
      });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [currentProjectSnapshot, doc, loadError, project]);

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
      if (!projectRef.current) return;
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

  // 장면 동결: 현재 DOM을 single-file-core로 굳혀 스냅샷 업로드 (§5, §3.7).
  // 등록 직후 자동 실행 + 각 장면의 재동결 버튼에서 재호출.
  const runFreeze = async (sceneId: string) => {
    setFreezing((f) => ({ ...f, [sceneId]: true }));
    setFreezeErr((e) => { const { [sceneId]: _drop, ...rest } = e; return rest; });
    try {
      const html = await freezeDocument();
      const assetKey = await uploadSnapshot(projectId, html);
      setDoc((d) => setSceneSnapshot(d, sceneId, assetKey, new Date().toISOString()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "동결 실패";
      setFreezeErr((e) => ({ ...e, [sceneId]: msg }));
      console.warn("[mockspec] 동결 실패:", err);
    } finally {
      setFreezing((f) => { const { [sceneId]: _drop, ...rest } = f; return rest; });
    }
  };

  const registerScene = () => {
    if (!projectRef.current) return;
    const title = document.title || "장면";
    const route = location.pathname + location.search + location.hash;
    const { doc: nd, scene } = createScene(doc, { title, route });
    setDoc(nd);
    setCurrentSceneId(scene.id);
    setNeedScene(false);
    void runFreeze(scene.id); // 등록 즉시 자동 동결
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
          <span class={`save save--${saveStatus}`}>{saveStatusLabel(saveStatus)}</span>
          <span class="status">{mode === "edit" ? "편집 중" : "미리보기"}</span>
          <button class="panel__close" title="닫기" onClick={() => setOpen(false)}>×</button>
        </div>

        <div class="seg" role="tablist">
          <button class={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>미리보기</button>
          <button class={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>편집</button>
        </div>

        {loadError && <div class="hint hint--warn">{loadError}</div>}

        <div class="section">
          <div class="row">
            <h4>장면</h4>
            <button class="btn" disabled={!project} onClick={registerScene}>+ 현재 화면을 장면으로</button>
          </div>
          {!project && !loadError && <div class="muted">프로젝트를 불러오는 중입니다.</div>}
          {project && doc.scenes.length === 0 && <div class="muted">아직 장면이 없습니다. 위 버튼으로 현재 화면을 장면으로 등록하세요.</div>}
          <ul class="list">
            {doc.scenes.map((s) => (
              <li key={s.id} class={`scene${s.id === currentSceneId ? " scene--cur" : ""}`}>
                <div class="scene__row">
                  <button class="scene__pick" onClick={() => setCurrentSceneId(s.id)}>
                    <span class="scene__code">{s.code}</span> {s.title || "(제목 없음)"}
                  </button>
                  <button
                    class="scene__refreeze" title="다시 동결"
                    disabled={freezing[s.id]}
                    onClick={() => void runFreeze(s.id)}
                  >⟳</button>
                  <button class="scene__del" title="삭제" onClick={() => removeScene(s.id)}>×</button>
                </div>
                <div class="scene__frz">
                  {freezing[s.id] ? (
                    <span class="frz frz--busy"><span class="spin" /> 동결 중…</span>
                  ) : freezeErr[s.id] ? (
                    <button class="frz frz--err" title={freezeErr[s.id]} onClick={() => void runFreeze(s.id)}>
                      동결 실패 — 재시도
                    </button>
                  ) : s.snapshotAsset ? (
                    <span class="frz frz--ok">✓ 동결됨 {s.frozenAt ? new Date(s.frozenAt).toLocaleTimeString() : ""}</span>
                  ) : (
                    <span class="frz frz--none">아직 동결 안 됨</span>
                  )}
                </div>
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
