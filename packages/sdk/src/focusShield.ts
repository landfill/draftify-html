/**
 * [S2.5] 포커스 이벤트 차단 (경로 D 실사용 — Nexacro 등 페이지 프레임워크 대응).
 *
 * 일부 엔터프라이즈 프레임워크(예: TOBESOFT Nexacro)는 **document 캡처 단계** 포커스
 * 핸들러로 전역 포커스를 관리한다 — 자기 컴포넌트가 아닌 요소에 포커스가 가면 자기 요소로
 * 되돌린다. 우리 편집 패널은 페이지 body에 붙인 Shadow DOM 호스트 안에 있어, 패널 입력에
 * 포커스가 가면 그 프레임워크가 "외부 요소"로 보고 포커스를 가로챈다(→ 앞 칸·설명창 입력 불가).
 *
 * 방어: **window 캡처 단계**에서 우리 호스트로 향하는 포커스 이벤트를 stopImmediatePropagation.
 * 캡처 전파는 window → document → … 순이라, window 캡처 리스너가 document(프레임워크)
 * 핸들러보다 **먼저** 발동해 전파를 끊는다. (호스트 버블 단계 차단은 캡처형 핸들러를 못 막아
 * 실패했다 — 실사용에서 확인.) 포커스 자체(기본 동작)는 막히지 않아 입력은 그대로 되고,
 * 키입력(keydown/input)은 다른 이벤트라 영향 없다. 대신 우리 패널의 focus/blur 리스너도
 * 안 타므로, 선택 추종은 onFocus가 아니라 onMouseDown으로 처리한다 (App.tsx).
 */
export function shieldFocusEvents(host: HTMLElement): void {
  const withinPanel = (e: Event): boolean => {
    const path = e.composedPath?.();
    return path && path.length ? path.includes(host) : e.target === host;
  };
  for (const type of ["focus", "blur", "focusin", "focusout"]) {
    window.addEventListener(
      type,
      (e) => {
        if (withinPanel(e)) e.stopImmediatePropagation();
      },
      true // 캡처 — 페이지의 document 핸들러보다 먼저
    );
  }
}
