/**
 * [S2.5] 포커스 이벤트 차단 (경로 D 실사용 — Nexacro 등 페이지 프레임워크 대응).
 *
 * 일부 엔터프라이즈 프레임워크(예: TOBESOFT Nexacro)는 document 레벨 `focusin` 핸들러로
 * 전역 포커스를 관리한다 — 자기 컴포넌트가 아닌 요소에 포커스가 가면 자기 요소로 되돌린다.
 * 우리 편집 패널은 페이지 body에 붙인 Shadow DOM 호스트 안에 있어, 패널 입력에 포커스가
 * 가면 그 프레임워크가 "외부 요소"로 보고 포커스를 가로챈다(→ 앞 칸·설명창 입력 불가).
 *
 * Shadow 경계에서 `focusin`/`focusout`은 호스트로 리타깃되어 버블하므로, **호스트에서
 * stopImmediatePropagation**하면 document의 페이지 핸들러까지 전파되지 않는다.
 * 우리 내부 포커스 처리는 shadow 안에서 끝나므로 영향이 없다.
 */
export function shieldFocusEvents(host: HTMLElement): void {
  for (const type of ["focusin", "focusout"]) {
    host.addEventListener(type, (e) => e.stopImmediatePropagation());
  }
}
