/**
 * [S2.5] 페이지 프레임워크의 포커스 가로채기 차단 (경로 D 실사용 — Nexacro 등).
 *
 * 일부 엔터프라이즈 프레임워크(예: TOBESOFT Nexacro)는 **document 캡처 단계**에서 전역
 * 포커스를 관리한다. 실측된 두 가지 방해:
 *  1) `mousedown`을 `preventDefault()` — 자기 컴포넌트가 아닌 요소의 클릭 포커스를 막는다.
 *     mousedown의 기본 동작이 "포커스"라, 우리 패널 입력을 클릭해도 포커스가 안 잡힌다
 *     (→ 유일하게 프로그램적으로 포커스되는 마지막 항목만 입력됨 — 실사용 증상).
 *  2) `focusin`/`focus` 핸들러로 외부 포커스를 자기 요소로 되돌림.
 *
 * 방어: **window 캡처 단계**에서 우리 호스트로 향하는 해당 이벤트를 stopImmediatePropagation.
 * 캡처 전파는 window → document → … 순이라, window 캡처가 document(프레임워크) 핸들러보다
 * **먼저** 발동해 전파를 끊는다(호스트 버블·document 버블 차단은 캡처형 핸들러를 못 막는다 —
 * 실사용에서 확인). stopPropagation은 기본 동작(포커스)을 막지 않으므로 입력은 정상 포커스된다.
 *
 * 포인터/마우스 다운은 **입력칸(INPUT/TEXTAREA)을 누른 경우에만** 차단한다 — Nexacro는
 * `mousedown`뿐 아니라 `pointerdown`도 preventDefault해 포커스를 막으므로 둘 다 지켜야 하지만,
 * 마커(onPointerDown 드래그)의 pointerdown까지 끊으면 드래그가 깨진다. 실제 타겟이 입력칸일
 * 때만 끊으면 포커스는 복원되고 마커 드래그는 보존된다. 우리 입력의 mousedown 리스너도 안
 * 타므로 선택 추종은 onClick으로 처리한다 (App.tsx).
 */
export function shieldFocusEvents(host: HTMLElement): void {
  const withinPanel = (e: Event): boolean => {
    const path = e.composedPath?.();
    return path && path.length ? path.includes(host) : e.target === host;
  };
  const targetIsEditable = (e: Event): boolean => {
    const t = e.composedPath?.()[0];
    return t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
  };
  // 포커스 되돌리기(focus 계열) — 패널 안이면 전부 차단
  for (const type of ["focus", "blur", "focusin", "focusout"]) {
    window.addEventListener(type, (e) => { if (withinPanel(e)) e.stopImmediatePropagation(); }, true);
  }
  // 클릭 포커스 막기(mouse/pointer down의 preventDefault) — 입력칸을 누른 경우만 차단(마커 드래그 보존)
  for (const type of ["mousedown", "pointerdown"]) {
    window.addEventListener(type, (e) => {
      if (withinPanel(e) && targetIsEditable(e)) e.stopImmediatePropagation();
    }, true);
  }
}
