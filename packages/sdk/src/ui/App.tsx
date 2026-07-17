import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { Annotation, MarkerOffset, SpecProject } from "@mockspec/shared";
import { pickTarget, generateAnchor, resolveAnchor, contentScrollSize } from "../anchor/anchor.js";
import {
  emptyDoc, createScene, deleteScene, addAnnotation, updateAnnotation,
  deleteAnnotation, deleteEmptyAnnotations, isEmptyAnnotation,
  annotationsOfScene, updateAnchorSelector, setSceneSnapshot, updateSceneTitle,
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
import { currentRoute, observeRouteChanges } from "../routeChanges.js";

/**
 * SDK 편집기: 장면(그릇) + 어노테이션 부착 + 앵커/마커 + 장면 캡처 + 저장.
 * 장면 등록 시 현재 DOM을 즉시 캡처(single-file-core)해 스냅샷을 업로드한다.
 * 편집 상태는 500ms 디바운스로 전체 SpecProject PUT, 실패 시 최신본 1개를 localStorage에 둔다.
 */

type Mode = "preview" | "edit";
type SaveStatus = "loading" | "saved" | "saving" | "offline" | "error";
interface Rect { top: number; left: number; width: number; height: number; }

/** 마커 드래그 진행 상태. moved=임계값(4px) 초과 — 클릭(선택)과 드래그를 구분한다. */
interface MarkerDrag { annId: string; startX: number; startY: number; dx: number; dy: number; moved: boolean; }

const DRAG_THRESHOLD_PX = 4;
const PANEL_W = 360;          // 도킹 패널 폭 (styles.ts .panel과 동일)
const MARKER_CLEARANCE = 48;  // 스크롤 추종 시 마커가 패널 경계에 걸리지 않게 두는 여유

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
  // 캡처 진행/실패 상태 (성공은 scene.snapshotAsset로 표현). sceneId → 값.
  const [freezing, setFreezing] = useState<Record<string, boolean>>({});
  const [freezeErr, setFreezeErr] = useState<Record<string, string>>({});
  const [drag, setDrag] = useState<MarkerDrag | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [routeSuggestion, setRouteSuggestion] = useState<string | null>(null);
  // 패널 비켜주기(peek, 이슈 #8): 패널이 얇은 탭으로 접혀 마커 가림을 해소한다
  const [peek, setPeek] = useState(false);
  // 추종 후에도 마커가 패널에 가려 있는 선택 항목 — 안내·[패널 접고 마커 보기] 노출 대상
  const [hiddenMarkerAnn, setHiddenMarkerAnn] = useState<string | null>(null);

  // 옵저버/전역 리스너가 최신 상태를 읽도록 ref 래핑
  const projectRef = useRef(project); projectRef.current = project;
  const docRef = useRef(doc); docRef.current = doc;
  const sceneRef = useRef(currentSceneId); sceneRef.current = currentSceneId;
  const modeRef = useRef(mode); modeRef.current = mode;
  const dragRef = useRef(drag); dragRef.current = drag;
  const peekRef = useRef(peek); peekRef.current = peek;
  const selectedAnnRef = useRef(selectedAnn); selectedAnnRef.current = selectedAnn;
  const suppressClickRef = useRef(false);
  // 최초 route는 이미 본 것으로 간주하고, 이후 route별 세션 1회만 제안한다 (§11 16차).
  const seenRoutesRef = useRef(new Set([currentRoute()]));
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

  // 패널 열림·모드와 무관하게 SDK 생존 기간 전체를 감지한다. 닫힌 패널에서 생긴 제안도
  // state에 보존되어 다음에 패널을 열 때 표시된다 (FR-EDT-06).
  useEffect(() => observeRouteChanges((route) => {
    if (seenRoutesRef.current.has(route)) {
      // 제안 중 다른(이미 본) route로 이동했다면 낡은 제안을 남기지 않는다.
      setRouteSuggestion(null);
      return;
    }
    seenRoutesRef.current.add(route);
    setRouteSuggestion(route);
  }), []);

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

  // 패널 도킹 시 목업 레이아웃 360px 축소 (peek 중에는 패널이 접혀 있으니 원폭 복귀).
  // 도킹 중일 때만 스타일을 건드리고 margin·transition 모두 원복한다 — 닫힘 상태에서
  // 페이지 자신의 인라인 스타일을 덮어쓰지 않는다 (PR #19 리뷰 반영).
  useEffect(() => {
    if (!open || peek) return;
    const el = document.documentElement;
    const prevMargin = el.style.marginRight;
    const prevTransition = el.style.transition;
    el.style.transition = "margin-right .15s ease";
    el.style.marginRight = "360px";
    return () => {
      el.style.marginRight = prevMargin;
      el.style.transition = prevTransition;
    };
  }, [open, peek]);

  // 패널이 닫히면 페이지 원 스크롤 범위로 복귀 (스페이서는 open 수명에만 종속)
  useEffect(() => {
    if (!open) return;
    return () => resetScrollSpacer();
  }, [open]);

  // 스크롤 스페이서 (이슈 #8): 도킹 margin-right는 고정폭 페이지의 스크롤 범위를
  // 늘리지 못해, 문서 오른쪽 끝 패널 폭(360px)만큼의 띠는 최대 스크롤에서도 패널에
  // 가린 채 드러낼 방법이 없다 (Chromium 실측: 루트 margin/padding 모두 scrollWidth
  // 불변). 콘텐츠 폭+패널 폭의 불가시 스페이서(캡처 제외 마킹 data-mockspec-root)로
  // 그 띠까지 스크롤로 노출한다. 도킹 리플로우로 콘텐츠가 패널에 안 가리는 페이지에서는
  // 결과 폭이 뷰포트 이하라 스크롤을 만들지 않는다. height 0은 스크롤 오버플로에
  // 기여하지 않아 1px + visibility:hidden(레이아웃 유지·히트테스트 제외)을 쓴다.
  const ensureScrollSpacer = (markerDocX = 0) => {
    let spacer = document.querySelector<HTMLElement>("[data-mockspec-scroll-spacer]");
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.setAttribute("data-mockspec-root", ""); // 캡처 제외 마킹 (freeze §5)
      spacer.setAttribute("data-mockspec-scroll-spacer", "");
      spacer.setAttribute("aria-hidden", "true");
      Object.assign(spacer.style, {
        position: "absolute", left: "0", top: "0", height: "1px",
        visibility: "hidden", pointerEvents: "none",
      });
      document.body.appendChild(spacer);
    }
    spacer.style.width = "0"; // 이전 스페이서 폭을 빼고 실제 콘텐츠 폭을 잰다
    const contentExtent = document.body.scrollWidth;
    // 앵커 rect 비율의 분모 보정용 실측값 (anchor.ts contentScrollSize가 읽는다)
    spacer.setAttribute("data-content-width", String(contentExtent));
    // 도달 목표 = max(콘텐츠 오른쪽 끝, 추종 대상 마커 + 여유). 패널이 열려 있는 동안은
    // 줄이지 않는다 — 확장 영역으로 스크롤된 상태에서 줄이면 스크롤이 즉시 클램프되어 튄다.
    const prevReach = Number(spacer.getAttribute("data-reach")) || 0;
    const reach = Math.max(contentExtent, markerDocX + MARKER_CLEARANCE, prevReach);
    spacer.setAttribute("data-reach", String(reach));
    spacer.style.width = `${reach + PANEL_W}px`;
  };

  const resetScrollSpacer = () => {
    document.querySelector("[data-mockspec-scroll-spacer]")?.remove();
  };

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
        if (existing) {
          // peek 중이었어도 선택 항목을 보려면 패널이 돌아와야 한다. followMarkerIfHidden이
          // 복귀 후 패널 폭 기준으로 판단하도록 ref를 즉시 갱신한다 (setState는 비동기).
          peekRef.current = false; setPeek(false);
          setSelectedAnn(existing.id);
          followMarkerIfHidden(existing); // 요소는 클릭했지만 마커는 패널에 가릴 수 있다
          return;
        }
      }

      const anchor = generateAnchor(target);            // ID-06
      const { doc: nd, annotation } = addAnnotation(docRef.current, scene, anchor);
      peekRef.current = false; setPeek(false);           // 제목 입력을 위해 패널 복귀
      setDoc(nd);
      newAnnRef.current = annotation.id;                 // 이 항목만 title 자동 포커스 대상
      setSelectedAnn(annotation.id);                    // 패널 항목 열고 포커스
      followMarkerIfHidden(annotation);                  // 생성 직후 마커가 가려지면 추종 (이슈 #8)
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
    setHiddenMarkerAnn(null);
    setPeek(false); // 선택이 사라지면 패널이 비켜줄 이유도 사라진다
    // 대기 중인 정착 재확인도 무효 — 닫힌 뒤 뒤늦은 scrollTo로 화면이 튀지 않게 (PR #19 리뷰)
    window.clearTimeout(checkTimerRef.current);
  }, [currentSceneId, open]);

  const clearEmptyAnns = (sceneId: string) => {
    const count = annotationsOfScene(doc, sceneId).filter(isEmptyAnnotation).length;
    if (count === 0) return;
    if (!confirm(`제목·설명이 빈 어노테이션 ${count}개를 삭제합니다. 끝 번호는 다음 추가 시 재사용될 수 있습니다.`)) return;
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

  /** 마커의 문서 좌표 (기본 위치 = 요소 좌상단 + 드래그 오프셋). 렌더(useMarkers)와 동일 기준.
   *  뷰어와 같은 규칙으로 문서 좌표를 14px 안쪽으로 클램프 — 좌상단 부착부터 문서
   *  가장자리 요소(body margin 8px 등)의 마커(중심 렌더, 반경 14px)가 잘리는 것 방지. */
  const markerDocPoint = (ann: Annotation): { x: number; y: number; el: Element | null } => {
    const res = resolveAnchor(ann.anchor, document);
    let x: number, y: number;
    if (res.el) {
      const r = res.el.getBoundingClientRect();
      x = r.left + window.scrollX;
      y = r.top + window.scrollY;
    } else {
      // rect fallback (앵커 미해석): 저장된 문서 비율 좌표
      const size = contentScrollSize(document);
      x = ann.anchor.rect.x * size.width;
      y = ann.anchor.rect.y * size.height;
    }
    const off = ann.markerOffset ?? { dx: 0, dy: 0 };
    return { x: Math.max(14, x + off.dx), y: Math.max(14, y + off.dy), el: res.el };
  };

  /** 마커가 패널을 제외한 가시영역 안에 있는가 (인자는 문서 좌표). peek 중엔 전체 폭.
   *  마커는 중심 기준 렌더(translate -50%)라 패널 쪽 경계만 반폭(12px) 여유를 본다 —
   *  상·좌·하단은 중심 기준 유지 (상단 요소 클릭마다 불필요한 스크롤 방지). */
  const markerInView = (x: number, y: number): boolean => {
    const vx = x - window.scrollX;
    const vy = y - window.scrollY;
    const panelW = peekRef.current ? 0 : PANEL_W;
    return vx >= 0 && vx + 12 <= window.innerWidth - panelW && vy >= 0 && vy <= window.innerHeight;
  };

  // 패널 비켜주기(peek, 이슈 #8): 창 스크롤이 무효한 페이지 — body 자체가
  // position:fixed(+overflow:hidden)인 Nexacro류 사내 시스템, 내부 커스텀 스크롤 —
  // 에서는 스페이서·scrollTo·scrollIntoView 어느 것도 패널에 가린 마커를 못 드러낸다.
  // 페이지를 움직이는 대신 가림의 원인인 **패널이 얇은 탭으로 접혀 비켜준다** —
  // 페이지 무이동·좌표 계약 무변경, 복귀 수단(탭)이 눈에 보인다. 추종 정착 후에도
  // 마커가 가려져 있으면 항목에 안내와 [패널 접고 마커 보기] 버튼을 노출한다.
  const checkTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(checkTimerRef.current), []); // 언마운트 시 정리

  // 추종 정착 후 재확인. retry=true면 내부 overflow 컨테이너 스크롤로 문서 좌표가
  // 변했을 수 있어 신선한 좌표로 window 목표를 1회 보정한다 (PR #19 리뷰 반영).
  // 안내는 **패널 겹침일 때만** — 뷰포트 밖(상하·왼쪽·오른쪽 너머) 마커는 패널을
  // 접어도 안 드러나므로 [패널 접고 마커 보기]를 권하지 않는다 (codex P2).
  const recheckMarkerHidden = (annId: string, retry: boolean) => {
    // 선택이 이미 다른 곳으로 갔으면(마커 클릭 등 추종 없는 선택 변경 포함) 무효 —
    // 옛 어노테이션 기준의 보정 scrollTo·안내가 뒤늦게 발동하지 않는다 (PR #19 리뷰)
    if (selectedAnnRef.current !== annId) return;
    const ann = docRef.current.annotations.find((a) => a.id === annId);
    if (!ann) { setHiddenMarkerAnn(null); return; }
    const { x, y, el } = markerDocPoint(ann);
    if (!el || markerInView(x, y)) { setHiddenMarkerAnn(null); return; }
    if (retry) {
      const panelW = peekRef.current ? 0 : PANEL_W;
      window.scrollTo({
        left: x - (window.innerWidth - panelW) / 2,
        top: y - window.innerHeight / 2,
        behavior: "smooth",
      });
      checkTimerRef.current = window.setTimeout(() => recheckMarkerHidden(annId, false), 700);
      return;
    }
    const vx = x - window.scrollX;
    const vy = y - window.scrollY;
    const inPanelBand = vx + 12 > window.innerWidth - PANEL_W && vx - 12 <= window.innerWidth
      && vy >= 0 && vy <= window.innerHeight;
    setHiddenMarkerAnn(inPanelBand ? annId : null);
  };

  const restorePanel = () => {
    setPeek(false);
    // 패널이 돌아오면(도킹 복원 후) 같은 항목이 다시 가려지는지 재확인해 안내를 되살린다
    const annId = selectedAnn;
    window.clearTimeout(checkTimerRef.current);
    if (annId) checkTimerRef.current = window.setTimeout(() => recheckMarkerHidden(annId, false), 300);
  };

  // peek 전환 시 포커스를 탭으로 — transform으로 숨은 패널에 포커스가 남지 않게 (a11y)
  useEffect(() => {
    if (!peek) return;
    const host = document.querySelector("[data-mockspec-root]");
    (host?.shadowRoot ?? host)?.querySelector<HTMLButtonElement>(".panel-tab")?.focus();
  }, [peek]);

  // 어노테이션 선택·생성 시 마커를 가시영역으로 스크롤 (이슈 #8).
  // 스크롤 목표는 요소 중앙이 아니라 **마커 좌표**를 패널 제외 가시영역 중앙에 두는 것 —
  // 요소 중앙 기준이면 넓은 요소·오른쪽 끝 요소·드래그된 마커에서 마커가 패널에 가린다.
  // 내부 overflow 컨테이너는 scrollIntoView가 처리하고, window 스크롤 목표는 곧바로
  // 뒤이은 scrollTo가 이어받는다 (같은 smooth 대상이라 마지막 호출이 이긴다).
  const scrollMarkerIntoView = (ann: Annotation) => {
    const { x, y, el } = markerDocPoint(ann);
    ensureScrollSpacer(x); // 마커+여유까지 스크롤 도달 보장
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    const panelW = peekRef.current ? 0 : PANEL_W;
    window.scrollTo({
      left: x - (window.innerWidth - panelW) / 2,
      top: y - window.innerHeight / 2,
      behavior: "smooth",
    });
    // smooth 스크롤 정착 후 재확인(내부 스크롤 보정 1회 포함) — 창 스크롤이 무효한
    // 페이지면 여전히 가려져 있고, 패널 겹침이면 [패널 접고 마커 보기] 안내를 노출한다
    window.clearTimeout(checkTimerRef.current);
    setHiddenMarkerAnn(null);
    checkTimerRef.current = window.setTimeout(() => recheckMarkerHidden(ann.id, true), 700);
  };

  // 생성·기존 요소 클릭 선택용: 요소 자체는 방금 클릭해서 보이지만, 마커(좌상단)는
  // 오른쪽 가장자리 요소에서 패널에 가릴 수 있다 — 가려질 때만 추종해 불필요한 이동을 피한다.
  const followMarkerIfHidden = (ann: Annotation) => {
    const { x, y } = markerDocPoint(ann);
    if (!markerInView(x, y)) scrollMarkerIntoView(ann);
  };

  // 선택이 실제로 바뀔 때만 스크롤 — 이미 선택된 항목을 편집하는 중의 클릭마다
  // 뷰포트가 재정렬되면 오히려 방해다.
  const selectAnnFromPanel = (annId: string) => {
    if (selectedAnn !== annId) {
      const ann = docRef.current.annotations.find((a) => a.id === annId);
      if (ann) scrollMarkerIntoView(ann);
    }
    setSelectedAnn(annId);
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

  // 장면 캡처: 현재 DOM을 single-file-core로 굳혀 스냅샷 업로드 (§5, §3.7).
  // 등록 직후 자동 실행 + 각 장면의 재캡처 버튼에서 재호출.
  const runFreeze = async (sceneId: string) => {
    setFreezing((f) => ({ ...f, [sceneId]: true }));
    setFreezeErr((e) => { const { [sceneId]: _drop, ...rest } = e; return rest; });
    try {
      const html = await freezeDocument();
      const assetKey = await uploadSnapshot(projectId, html);
      // 캡처 시점 뷰포트 크기 — 뷰어가 이 크기로 렌더해 반응형(폭)·100vh류(높이) 페이지도
      // 캡처했던 레이아웃 그대로 재현된다 (캡처가 도킹 마진을 제거하므로 전체 폭이 기준).
      const capture = {
        width: document.documentElement.clientWidth || window.innerWidth,
        height: document.documentElement.clientHeight || window.innerHeight,
      };
      setDoc((d) => setSceneSnapshot(d, sceneId, assetKey, new Date().toISOString(), capture));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "캡처 실패";
      setFreezeErr((e) => ({ ...e, [sceneId]: msg }));
      console.warn("[mockspec] 캡처 실패:", err);
    } finally {
      setFreezing((f) => { const { [sceneId]: _drop, ...rest } = f; return rest; });
    }
  };

  // 편집 화면 내보내기 — 콘솔과 동일 규칙(스냅샷 없는 장면 확인·50MB 경고), §3.9·킥오프 §11 6차.
  const runExport = async () => {
    const d = docRef.current;
    const missing = d.scenes.filter((s) => !s.snapshotAsset).length;
    if (missing > 0 && !confirm(`${missing}개 화면에 스냅샷이 없습니다. 산출물에 플레이스홀더로 표시됩니다. 계속할까요?`)) return;

    setExporting(true);
    setExportNote(null);
    try {
      const result = await exportProjectHtml(projectId);
      if (result.nativeDownload) {
        // 경로 D: 확장이 chrome.downloads로 직접 저장 — 브라우저 다운로드 바에서 확인
        setExportNote("브라우저 다운로드로 저장을 시작했습니다.");
        return;
      }
      const { blob, filename, warning } = result;
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
    // 제목 기본값 없음 — SPA는 document.title이 불변이라 모든 장면에 같은 무의미한 제목이
    // 붙는다(실사용 피드백). 목록의 인라인 입력으로 사용자가 직접 명명한다 (킥오프 §11 8차).
    const route = currentRoute();
    const { doc: nd, scene } = createScene(doc, { title: "", route });
    setDoc(nd);
    setCurrentSceneId(scene.id);
    setRouteSuggestion(null);
    setNeedScene(false);
    void runFreeze(scene.id); // 등록 즉시 자동 캡처
  };

  const removeScene = (id: string) => {
    const anns = annotationsOfScene(doc, id).length;
    if (!confirm(`이 화면과 어노테이션 ${anns}개가 삭제됩니다.`)) return;
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
          위치 = 기본(요소 좌상단) + markerOffset. 편집 모드에선 드래그로 오프셋 조정 (§3.5).
          뷰어와 같은 규칙으로 문서 좌표 14px 클램프(뷰포트 좌표로 환산) — 문서 가장자리
          요소의 마커 잘림 방지. 스크롤로 문서 안쪽이 보일 땐 클램프가 발동하지 않는다 */}
      {markers.map((m) => {
        const off = markerOffsetOf(m.annId);
        return (
          <button
            key={m.annId}
            class={`marker${m.uncertain ? " marker--uncertain" : ""}${selectedAnn === m.annId ? " marker--sel" : ""}${drag?.annId === m.annId ? " marker--drag" : ""}${emptyAnnIds.has(m.annId) ? " marker--empty" : ""}`}
            style={{ left: Math.max(14 - window.scrollX, m.x + off.dx), top: Math.max(14 - window.scrollY, m.y + off.dy) }}
            title={m.uncertain ? "위치 불확실" : emptyAnnIds.has(m.annId) ? "미작성 — 제목·설명이 비어 있습니다" : undefined}
            onPointerDown={onMarkerPointerDown(m.annId)}
            onClick={() => {
              if (suppressClickRef.current) { suppressClickRef.current = false; return; }
              setSelectedAnn(m.annId);
            }}
          >{m.number}</button>
        );
      })}

      {peek && (
        <button
          class="panel-tab" title="패널 펼치기"
          onClick={restorePanel}
        >❮</button>
      )}
      {/* peek 중엔 inert — transform으로 숨은 패널이 Tab 포커스를 받지 않게 (PR #19 리뷰) */}
      <div class={`panel${peek ? " panel--peek" : ""}`} inert={peek} role="complementary" aria-label="mockspec 편집 패널">
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
        {routeSuggestion && (
          <div class="route-banner" role="status">
            <span>새 화면으로 등록할까요?</span>
            <div class="route-banner__actions">
              <button class="btn" disabled={!project} onClick={registerScene}>등록</button>
              <button class="btn" onClick={() => setRouteSuggestion(null)}>무시</button>
            </div>
          </div>
        )}

        <div class="section">
          <div class="row">
            <h4>화면</h4>
            <button class="btn" disabled={!project} onClick={registerScene}>+ 현재 화면 등록</button>
          </div>
          {!project && !loadError && <div class="muted">프로젝트를 불러오는 중입니다.</div>}
          {project && doc.scenes.length === 0 && <div class="muted">아직 등록된 화면이 없습니다. 위 버튼으로 현재 화면을 등록하세요.</div>}
          <ul class="list">
            {doc.scenes.map((s) => (
              <li key={s.id} class={`scene${s.id === currentSceneId ? " scene--cur" : ""}`}>
                <div class="scene__row">
                  <button class="scene__pick" title="이 화면 선택" onClick={() => setCurrentSceneId(s.id)}>
                    <span class="scene__code">{s.code}</span>
                  </button>
                  <input
                    class="scene__title"
                    placeholder="화면 제목"
                    value={s.title}
                    onClick={() => setCurrentSceneId(s.id)}
                    onInput={(e) => setDoc(updateSceneTitle(doc, s.id, (e.target as HTMLInputElement).value))}
                  />
                  <button
                    class="scene__refreeze" title="다시 캡처"
                    disabled={freezing[s.id]}
                    onClick={() => void runFreeze(s.id)}
                  >⟳</button>
                  <button class="scene__del" title="삭제" onClick={() => removeScene(s.id)}>×</button>
                </div>
                <div class="scene__frz">
                  {freezing[s.id] ? (
                    <span class="frz frz--busy"><span class="spin" /> 캡처 중…</span>
                  ) : freezeErr[s.id] ? (
                    <button class="frz frz--err" title={freezeErr[s.id]} onClick={() => void runFreeze(s.id)}>
                      캡처 실패 — 재시도
                    </button>
                  ) : s.snapshotAsset ? (
                    <span class="frz frz--ok">✓ 캡처됨 {s.frozenAt ? new Date(s.frozenAt).toLocaleTimeString() : ""}</span>
                  ) : (
                    <span class="frz frz--none">아직 캡처 안 됨</span>
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
          {!scene && <div class="muted">화면을 선택하면 어노테이션을 달 수 있습니다.</div>}
          {scene && mode !== "edit" && <div class="muted">편집 모드에서 요소를 클릭해 어노테이션을 답니다.</div>}
          {scene && mode === "edit" && anns.length === 0 && (
            <div class={`hint${needScene ? " hint--warn" : ""}`}>
              요소를 클릭하면 어노테이션이 생성됩니다.
              이미 마커가 있는 요소는 클릭하면 선택되고, 하나 더 달려면 Shift+클릭.
              마커는 드래그로 옮길 수 있습니다.
            </div>
          )}
          {needScene && <div class="hint hint--warn">먼저 화면을 등록해주세요.</div>}
          {anns.map((a) => (
            <div key={a.id} class={`ann${selectedAnn === a.id ? " ann--sel" : ""}${emptyAnnIds.has(a.id) ? " ann--empty" : ""}`}>
              <div class="row">
                <span class="ann__num">{a.number}</span>
                <input
                  class="ann__title" data-ann-title={a.id}
                  placeholder="제목"
                  value={a.title}
                  onClick={() => selectAnnFromPanel(a.id)}
                  onInput={(e) => setDoc(updateAnnotation(doc, a.id, { title: (e.target as HTMLInputElement).value }))}
                />
                <button class="ann__del" title="삭제" onClick={() => setDoc(deleteAnnotation(doc, a.id))}>×</button>
              </div>
              {hiddenMarkerAnn === a.id && selectedAnn === a.id && !peek && (
                <div class="ann__hidden">
                  마커가 패널에 가려져 있습니다
                  <button class="btn" onClick={() => setPeek(true)}>패널 접고 마커 보기</button>
                </div>
              )}
              <textarea
                class="ann__desc" placeholder="설명 (마크다운)"
                value={a.description}
                onClick={() => selectAnnFromPanel(a.id)}
                onInput={(e) => setDoc(updateAnnotation(doc, a.id, { description: (e.target as HTMLTextAreaElement).value }))}
              />
              {/* 전이 지정 (§3.10) — 다른 장면이 있을 때만. 전이는 정의상 장면 간 연결이라
                  자기 장면은 나열하지 않는다. 조건 입력은 전이를 고른 뒤에만 노출 */}
              {doc.scenes.some((s) => s.id !== a.sceneId) && (
                <div class="ann__trans">
                  <select
                    class="ann__trans-scene" data-ann-trans={a.id}
                    title="이 요소 조작 시 이동할 화면"
                    value={a.transition?.toSceneId ?? ""}
                    onClick={() => selectAnnFromPanel(a.id)}
                    onChange={(e) => {
                      const toSceneId = (e.target as HTMLSelectElement).value;
                      setDoc(updateAnnotation(doc, a.id, {
                        transition: toSceneId
                          ? { toSceneId, condition: a.transition?.condition }
                          : undefined,
                      }));
                    }}
                  >
                    <option value="">이동 없음</option>
                    {doc.scenes.filter((s) => s.id !== a.sceneId).map((s) => (
                      <option key={s.id} value={s.id}>→ {s.code} {s.title || "(제목 없음)"}</option>
                    ))}
                  </select>
                  {a.transition && (
                    <input
                      class="ann__trans-cond" data-ann-trans-cond={a.id}
                      placeholder="조건 (예: 성공 시)"
                      value={a.transition.condition ?? ""}
                      onClick={() => selectAnnFromPanel(a.id)}
                      onInput={(e) => {
                        const condition = (e.target as HTMLInputElement).value;
                        setDoc(updateAnnotation(doc, a.id, {
                          transition: { toSceneId: a.transition!.toSceneId, condition: condition || undefined },
                        }));
                      }}
                    />
                  )}
                </div>
              )}
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
