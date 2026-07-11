import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { MarkerOffset, SpecProject } from "@mockspec/shared";
import { pickTarget, generateAnchor, resolveAnchor } from "../anchor/anchor.js";
import {
  emptyDoc, createScene, deleteScene, addAnnotation, updateAnnotation,
  deleteAnnotation, deleteEmptyAnnotations, isEmptyAnnotation,
  annotationsOfScene, updateAnchorSelector, setSceneSnapshot,
  docFromProject, applyDocToProject, projectContentSignature,
  type EditorDoc,
} from "../state.js";
import { freezeDocument } from "../freeze/freeze.js";
import {
  exportProjectHtml,
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

/** 마커 드래그 진행 상태. moved=임계값(4px) 초과 — 클릭(선택)과 드래그를 구분한다. */
interface MarkerDrag { annId: string; startX: number; startY: number; dx: number; dy: number; moved: boolean; }

const DRAG_THRESHOLD_PX = 4;

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
  const [drag, setDrag] = useState<MarkerDrag | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // 옵저버/전역 리스너가 최신 상태를 읽도록 ref 래핑
  const projectRef = useRef(project); projectRef.current = project;
  const docRef = useRef(doc); docRef.current = doc;
  const sceneRef = useRef(currentSceneId); sceneRef.current = currentSceneId;
  const modeRef = useRef(mode); modeRef.current = mode;
  const dragRef = useRef(drag); dragRef.current = drag;
  const suppressClickRef = useRef(false);
  // 방금 생성한 어노테이션 id — title 자동 포커스는 "생성 시 1회"에만 한다.
  // (실사용: 앞 번호 칸을 편집 중인데 재렌더로 포커스가 마지막 칸으로 튀는 버그 방지)
  const newAnnRef = useRef<string | null>(null);
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

      // 이미 어노테이션이 달린 요소는 선택으로 — 중복 생성 방지 (킥오프 §11 4차 개정).
      // 같은 요소에 하나 더 달려면 Shift+클릭.
      if (!e.shiftKey) {
        const existing = annotationsOfScene(docRef.current, scene)
          .find((a) => resolveAnchor(a.anchor, document).el === target);
        if (existing) { setSelectedAnn(existing.id); return; }
      }

      const anchor = generateAnchor(target);            // ID-06
      const { doc: nd, annotation } = addAnnotation(docRef.current, scene, anchor);
      setDoc(nd);
      newAnnRef.current = annotation.id;                 // 이 항목만 title 자동 포커스 대상
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

  // 빈 어노테이션은 "미작성 핀"으로 유지한다 — 요소를 먼저 찍고 내용은 나중에 작성하는
  // 워크플로우 지원 (킥오프 §11 5차 개정, 4차 개정의 선택 해제 시 자동 삭제 철회).
  // 잔재 정리는 아래 [빈 어노테이션 정리] 버튼(사용자 주도)으로.

  // 장면 전환·패널 닫기 시 선택 해제 (다른 장면 소속 선택이 남지 않도록)
  useEffect(() => {
    setSelectedAnn(null);
  }, [currentSceneId, open]);

  const clearEmptyAnns = (sceneId: string) => {
    const count = annotationsOfScene(doc, sceneId).filter(isEmptyAnnotation).length;
    if (count === 0) return;
    if (!confirm(`제목·설명이 빈 어노테이션 ${count}개를 삭제합니다. 번호는 재사용되지 않습니다.`)) return;
    setDoc((d) => deleteEmptyAnnotations(d, sceneId));
  };

  // 마커 드래그: 이동량을 markerOffset(기본 위치 기준 상대값)으로 커밋.
  // 절대 좌표를 저장하지 않아야 앵커 재해석(요소 추적)과 공존한다 (§3.5).
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d;
        const dx = e.clientX - d.startX;
        const dy = e.clientY - d.startY;
        return { ...d, dx, dy, moved: d.moved || Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX };
      });
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d && d.moved) {
        // 드래그 직후의 click은 선택으로 처리하지 않는다. click이 아예 안 오는 경우
        // (pointerup이 마커 밖에서 끝남)에 플래그가 남아 다음 클릭을 삼키지 않도록 곧 해제.
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
        const ann = docRef.current.annotations.find((a) => a.id === d.annId);
        const base = ann?.markerOffset ?? { dx: 0, dy: 0 };
        setDoc((cur) => updateAnnotation(cur, d.annId, {
          markerOffset: { dx: base.dx + d.dx, dy: base.dy + d.dy },
        }));
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag !== null]);

  const onMarkerPointerDown = (annId: string) => (e: PointerEvent) => {
    if (modeRef.current !== "edit") return; // 드래그는 편집 모드에서만
    e.preventDefault();
    setDrag({ annId, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, moved: false });
  };

  /** 마커 렌더 위치 = useMarkers 기본 위치 + 저장 오프셋 + (드래그 중이면) 진행 델타. */
  const markerOffsetOf = (annId: string): MarkerOffset => {
    const base = docRef.current.annotations.find((a) => a.id === annId)?.markerOffset
      ?? { dx: 0, dy: 0 };
    if (drag && drag.annId === annId) return { dx: base.dx + drag.dx, dy: base.dy + drag.dy };
    return base;
  };

  // 새 어노테이션 title 자동 포커스 — **방금 생성한 항목에만** (newAnnRef).
  // 의존성은 selectedAnn만: doc을 넣으면 편집 키스트로크마다 재실행되어 포커스를 강탈한다
  // (2026-07-09 실버그). 또한 생성 외의 선택 변경(마커 클릭·앞 칸 편집)에는 포커스를
  // 옮기지 않는다 — 앞 번호 칸을 편집 중 포커스가 마지막 칸으로 튀는 버그 방지 (실사용).
  useEffect(() => {
    if (!selectedAnn || newAnnRef.current !== selectedAnn) return;
    newAnnRef.current = null;
    const el = document.querySelector("[data-mockspec-root]")?.shadowRoot
      ?.querySelector<HTMLInputElement>(`[data-ann-title="${selectedAnn}"]`);
    el?.focus();
  }, [selectedAnn]);

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

  // 편집 화면 내보내기 — 콘솔과 동일 규칙(스냅샷 없는 장면 확인·50MB 경고), §3.9·킥오프 §11 6차.
  const runExport = async () => {
    const d = docRef.current;
    const missing = d.scenes.filter((s) => !s.snapshotAsset).length;
    if (missing > 0 && !confirm(`${missing}개 장면에 스냅샷이 없습니다. 산출물에 플레이스홀더로 표시됩니다. 계속할까요?`)) return;

    setExporting(true);
    setExportNote(null);
    try {
      const { blob, filename, warning } = await exportProjectHtml(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      if (warning) setExportNote(`경고: ${warning}`);
    } catch (err) {
      setExportNote(err instanceof Error ? err.message : "내보내기 실패");
    } finally {
      setExporting(false);
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
  const emptyAnnIds = new Set(anns.filter(isEmptyAnnotation).map((a) => a.id));

  return (
    <>
      {mode === "edit" && hover && (
        <div class="hl" style={{ top: hover.top, left: hover.left, width: hover.width, height: hover.height }} />
      )}
      {/* 마커: 미리보기·편집 양쪽에서 현재 장면 소속만 렌더 (ID-09).
          위치 = 기본(요소 우상단) + markerOffset. 편집 모드에선 드래그로 오프셋 조정 (§3.5) */}
      {markers.map((m) => {
        const off = markerOffsetOf(m.annId);
        return (
          <button
            key={m.annId}
            class={`marker${m.uncertain ? " marker--uncertain" : ""}${selectedAnn === m.annId ? " marker--sel" : ""}${drag?.annId === m.annId ? " marker--drag" : ""}${emptyAnnIds.has(m.annId) ? " marker--empty" : ""}`}
            style={{ left: m.x + off.dx, top: m.y + off.dy }}
            title={m.uncertain ? "위치 불확실" : emptyAnnIds.has(m.annId) ? "미작성 — 제목·설명이 비어 있습니다" : undefined}
            onPointerDown={onMarkerPointerDown(m.annId)}
            onClick={() => {
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              setSelectedAnn(m.annId);
            }}
          >{m.number}</button>
        );
      })}

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

        <div class="panel__body">
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
          <div class="row">
            <h4>어노테이션 {scene && `· ${scene.code}`}</h4>
            {scene && emptyAnnIds.size > 0 && (
              <button class="btn" title="제목·설명이 빈 어노테이션을 일괄 삭제" onClick={() => clearEmptyAnns(scene.id)}>
                빈 어노테이션 정리 ({emptyAnnIds.size})
              </button>
            )}
          </div>
          {!scene && <div class="muted">장면을 선택하면 어노테이션을 달 수 있습니다.</div>}
          {scene && mode !== "edit" && <div class="muted">편집 모드에서 요소를 클릭해 어노테이션을 답니다.</div>}
          {scene && mode === "edit" && anns.length === 0 && (
            <div class={`hint${needScene ? " hint--warn" : ""}`}>
              요소를 클릭하면 어노테이션이 생성됩니다.
              이미 마커가 있는 요소는 클릭하면 선택되고, 하나 더 달려면 Shift+클릭.
              마커는 드래그로 옮길 수 있습니다.
            </div>
          )}
          {needScene && <div class="hint hint--warn">먼저 장면을 등록해주세요.</div>}
          {anns.map((a) => (
            <div key={a.id} class={`ann${selectedAnn === a.id ? " ann--sel" : ""}${emptyAnnIds.has(a.id) ? " ann--empty" : ""}`}>
              <div class="row">
                <span class="ann__num">{a.number}</span>
                <input
                  class="ann__title" data-ann-title={a.id}
                  placeholder="제목"
                  value={a.title}
                  onClick={() => setSelectedAnn(a.id)}
                  onInput={(e) => setDoc(updateAnnotation(doc, a.id, { title: (e.target as HTMLInputElement).value }))}
                />
                <button class="ann__del" title="삭제" onClick={() => setDoc(deleteAnnotation(doc, a.id))}>×</button>
              </div>
              <textarea
                class="ann__desc" placeholder="설명 (마크다운)"
                value={a.description}
                onClick={() => setSelectedAnn(a.id)}
                onInput={(e) => setDoc(updateAnnotation(doc, a.id, { description: (e.target as HTMLTextAreaElement).value }))}
              />
            </div>
          ))}
        </div>
        </div>

        <div class="panel__foot">
          <button class="btn btn--export" disabled={!project || exporting} onClick={() => void runExport()}>
            {exporting ? "내보내는 중…" : "내보내기 (HTML 다운로드)"}
          </button>
          {exportNote && <div class="hint hint--warn">{exportNote}</div>}
        </div>
      </div>
    </>
  );
}
