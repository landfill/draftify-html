import { themeTokenDeclarations } from "@mockspec/shared";

/**
 * SDK UI 스타일. Shadow DOM 안에서만 적용되므로 목업 CSS와 충돌하지 않는다.
 * 별도 .css를 만들지 않고 문자열로 두는 이유: 번들을 단일 sdk.js로 유지 (technical-spec §1.2).
 *
 * 팔레트는 다른 표면과 같다 (이슈 #87 T87-13). Shadow DOM이라 :root가 닿지 않으므로
 * THEME_TOKENS를 :host에 선언해 var(--c-*)를 쓸 수 있게 한다 (ui-standard 4.6·4.7절).
 *
 * **라이트 고정이다** (Q-03, 2026-08-02 사용자 결정). SDK는 사용자의 목업 페이지 안에서
 * 돌아 콘솔의 data-theme을 상속할 수 없고, OS가 다크여도 밑의 목업은 대개 라이트다 —
 * 패널만 어두워지면 그 대비가 오히려 거슬린다. 그래서 dark 토큰을 선언하지 않고
 * prefers-color-scheme도 보지 않는다.
 */
export const STYLES = /* css */ `
:host {
${themeTokenDeclarations("light")}
}
:host, * { box-sizing: border-box; }

/*
  포커스 링 (이슈 #87 F-03, ui-standard 4.6절). 다른 표면과 같은 형태 — 2px 링 + 2px offset.
  다른 표면과 달리 input도 포함한다: 사내판·공개판의 입력은 box-shadow 링 규약이 이미
  있지만 SDK에는 없어, 여기서 버튼만 링을 주면 SDK 안에서 입력과 버튼이 갈린다.
*/
a:focus-visible, button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
  outline: 2px solid var(--c-accent-focus);
  outline-offset: 2px;
}
/*
  이 셋만 사용자의 목업 페이지 위에 직접 떠 있어 **링 바깥 색을 통제할 수 없다.**
  .fab은 배경이 링과 같은 강조색이라 그대로 두면 대비가 1:1이 된다.
  흰 띠를 덧대 분리한다 — .marker가 흰 테두리로 푸는 것과 같은 처리다.
  기존 그림자를 함께 적어야 사라지지 않는다.
*/
.fab:focus-visible { box-shadow: 0 0 0 6px rgba(255,255,255,.92), 0 4px 14px rgba(0,0,0,.28); }
.panel-tab:focus-visible { box-shadow: 0 0 0 6px rgba(255,255,255,.92), -2px 2px 10px rgba(0,0,0,.15); }
.marker:focus-visible { box-shadow: 0 0 0 6px rgba(255,255,255,.92), 0 1px 4px rgba(0,0,0,.35); }

.fab {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  width: 52px; height: 52px; border-radius: 50%; border: none;
  background: var(--c-btn-bg); color: #fff; font-size: 22px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.28);
  display: flex; align-items: center; justify-content: center;
  font-family: system-ui, sans-serif;
}
.fab:hover { background: var(--c-btn-bg-hover); }

.panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 360px; z-index: 2147483000;
  background: var(--c-surface); color: var(--c-text); border-left: 1px solid var(--c-border);
  box-shadow: -4px 0 18px rgba(0,0,0,.10);
  display: flex; flex-direction: column;
  font-family: system-ui, sans-serif; font-size: 13px;
  transition: transform .18s ease;
}
/* 패널 비켜주기(peek) — 마커가 패널에 가릴 때 화면 밖으로 접힌다 (이슈 #8).
   unmount가 아니라 transform이라 입력 중이던 내용·스크롤 위치가 보존된다 */
.panel--peek { transform: translateX(100%); }
.panel-tab {
  position: fixed; right: 0; top: 40%; z-index: 2147483000;
  width: 26px; height: 88px; border: 1px solid var(--c-border-2); border-right: none;
  border-radius: 8px 0 0 8px; background: rgba(255,255,255,.94); color: var(--c-accent);
  font-size: 13px; cursor: pointer; box-shadow: -2px 2px 10px rgba(0,0,0,.15);
  font-family: system-ui, sans-serif;
}
.panel-tab:hover { background: var(--c-surface); }
/* 선택 항목의 마커가 패널 뒤에 있을 때의 안내 (이슈 #8) */
.ann__hidden {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 6px; padding: 6px 8px; border-radius: 8px;
  background: #fff4e5; color: #b5560a; font-size: 11px; line-height: 1.4;
}
.ann__hidden .btn { flex: 0 0 auto; }
/* head·seg 아래 내용의 스크롤 영역 — 어노테이션이 늘어나도 끝까지 접근 가능해야 한다 */
.panel__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
/* 패널 하단 고정 — 내보내기 (§3.9) */
.panel__foot { flex: 0 0 auto; padding: 10px 14px; border-top: 1px solid var(--c-border); }
.btn--export { width: 100%; padding: 8px; font-size: 12px; font-weight: 600; }
.btn--export:disabled { opacity: .5; cursor: default; }
.panel__head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--c-border);
}
.panel__title { font-weight: 600; font-size: 13px; flex: 0 0 auto; }
.panel__pid { color: var(--c-muted); font-size: 11px; font-family: ui-monospace, monospace; }
.panel__spacer { flex: 1 1 auto; }
.panel__close {
  border: none; background: transparent; cursor: pointer; font-size: 18px;
  color: var(--c-muted); line-height: 1; padding: 2px 6px;
}
.panel__close:hover { color: var(--c-text); }
.save {
  flex: 0 1 auto; min-width: 0; max-width: 128px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: 11px; color: var(--c-muted);
}
.save--saved { color: var(--c-ok-text); }
.save--saving, .save--loading { color: var(--c-muted); }
.save--offline, .save--error { color: var(--c-danger-text); }

.seg { display: flex; margin: 12px 14px; border: 1px solid var(--c-border-2); border-radius: 8px; overflow: hidden; }
.seg button {
  flex: 1; border: none; background: var(--c-surface-2); padding: 8px 0; cursor: pointer;
  font-size: 12px; color: var(--c-muted);
}
.seg button.active { background: var(--c-btn-bg); color: #fff; font-weight: 600; }
/*
  세그먼트 버튼은 .seg의 overflow: hidden 안에 꽉 차 있다 — 바깥쪽 링(offset 2px)은
  경계를 넘는 부분이 잘린다(실측: 링 top 58 / left 934 vs .seg 59 / 935).
  안쪽으로 그려 온전히 보이게 한다. 공개판 .c-tab이 같은 이유로 -2px를 쓴다.
  (PR #92 Codex 리뷰)
*/
.seg button:focus-visible { outline-offset: -2px; }

.hint {
  margin: 0 14px 12px; padding: 8px 10px; border-radius: 8px;
  background: var(--c-accent-ring); color: var(--c-accent); font-size: 12px; line-height: 1.5;
}
.section { padding: 12px 14px; border-top: 1px solid var(--c-border); }
.section h4 { margin: 0 0 6px; font-size: 12px; color: var(--c-text-2); }
.section .muted { color: var(--c-muted); font-size: 12px; }

.status { margin-left: auto; font-size: 11px; color: var(--c-muted); }

/* 편집 모드 요소 하이라이트 (viewport 좌표, 클릭 통과) */
.hl {
  position: fixed; z-index: 2147482000; pointer-events: none;
  border: 2px solid var(--c-accent); background: var(--c-accent-ring);
  border-radius: 4px; transition: all .04s linear;
}

/* 숫자 마커 (요소 좌상단, viewport 좌표) */
.marker {
  position: fixed; z-index: 2147482500; transform: translate(-50%, -50%);
  min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px;
  border: 2px solid #fff; background: var(--c-btn-bg); color: #fff;
  font: 600 11px/16px system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
  touch-action: none; /* 포인터 드래그(마커 이동)용 */
}
.marker--drag { cursor: grabbing; }
/*
  선택 표시는 강조색과 **다른 색상**이어야 한다 — 같은 인디고면 선택 여부가 안 보인다.
  팔레트에 주황 토큰이 없어 값을 직접 쓴다. 원래 #d9480f였는데 흰 11px 글자와의 대비가
  4.30:1로 AA 미달이라 orange-700(#c2410c, 5.18:1)로 낮췄다 (T87-13).
*/
.marker--sel { background: #c2410c; }
.marker--uncertain { background: var(--c-muted); border-style: dashed; }
.marker--empty { opacity: .65; } /* 미작성 핀 — 내용이 비어 있음을 구분 표시 */

.row { display: flex; align-items: center; gap: 6px; }
.row h4 { flex: 1; }
.btn {
  border: 1px solid var(--c-accent); background: var(--c-accent-ring); color: var(--c-accent);
  border-radius: 8px; padding: 5px 8px; font-size: 11px; cursor: pointer;
}
/* hover는 같은 강조색을 채운다 — 색상 이동 없이 한 단계 강해진다 (ui-standard 4.6절). */
.btn:hover { background: var(--c-btn-bg); color: #fff; }
.btn:disabled { opacity: .45; cursor: default; }
.btn:disabled:hover { background: var(--c-accent-ring); color: var(--c-accent); }

.hint--warn { background: #fff4e5; color: #b5560a; }

/* SPA route 변경 제안 (FR-EDT-06) — 자동 전환 없이 사용자가 등록/무시를 고른다. */
.route-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  margin: 0 14px 12px; padding: 9px 10px; border: 1px solid #f1c27d; border-radius: 8px;
  background: #fff4e5; color: #8a4b08; font-size: 12px; line-height: 1.4;
}
.route-banner__actions { display: flex; gap: 5px; flex: 0 0 auto; }
.route-banner__actions .btn { padding: 4px 7px; }

.list { list-style: none; margin: 8px 0 0; padding: 0; }
.scene { margin-bottom: 6px; }
.scene__row { display: flex; align-items: center; gap: 4px; }
.scene__pick {
  flex: 0 0 auto; text-align: left; border: 1px solid var(--c-border); background: var(--c-surface-2);
  border-radius: 8px; padding: 6px 8px; cursor: pointer; font-size: 12px; color: var(--c-text-2);
}
.scene--cur .scene__pick { border-color: var(--c-accent); background: var(--c-accent-ring); }
.scene__code { font: 600 11px ui-monospace, monospace; color: var(--c-accent); }
.scene__title {
  flex: 1; min-width: 0; border: 1px solid var(--c-border-2); border-radius: 8px;
  padding: 5px 7px; font-size: 12px;
}
.scene--cur .scene__title { border-color: var(--c-accent-focus); }
.scene__refreeze {
  border: 1px solid var(--c-border-2); background: var(--c-surface-2); color: var(--c-muted); cursor: pointer;
  font-size: 13px; line-height: 1; border-radius: 8px; padding: 4px 6px;
}
.scene__refreeze:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-accent); }
.scene__refreeze:disabled { opacity: .4; cursor: default; }
.scene__del, .ann__del {
  border: none; background: transparent; color: var(--c-muted); cursor: pointer; font-size: 15px; padding: 2px 5px;
}
.scene__del:hover, .ann__del:hover { color: var(--c-danger-text); }

/* 캡처 상태 (장면 항목 하단) */
.scene__frz { margin: 3px 0 0 2px; font-size: 11px; }
.field { display: block; margin-top: 8px; }
.field__label { display: block; font-size: 11px; color: var(--c-muted); margin-bottom: 4px; }
.field__input {
  width: 100%; border: 1px solid var(--c-border-2); border-radius: 8px; padding: 5px 7px; font-size: 12px;
}
.frz { display: inline-flex; align-items: center; gap: 5px; }
.frz--busy { color: var(--c-muted); }
.frz--ok { color: var(--c-ok-text); }
.frz--none { color: var(--c-muted); }
.frz--err {
  border: 1px solid var(--c-danger-border); background: var(--c-danger-bg); color: var(--c-danger-text);
  border-radius: 4px; padding: 2px 7px; cursor: pointer; font-size: 11px;
}
.frz--err:hover { border-color: var(--c-danger-border-2); }
.spin {
  width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid var(--c-border-2); border-top-color: var(--c-accent);
  display: inline-block; animation: mockspec-spin .7s linear infinite;
}
@keyframes mockspec-spin { to { transform: rotate(360deg); } }

.ann { border: 1px solid var(--c-border); border-radius: 8px; padding: 8px; margin-top: 6px; }
.ann--empty { border-style: dashed; border-color: var(--c-border-2); background: var(--c-surface-2); } /* 미작성 핀 */
.ann--sel { border-color: #c2410c; border-style: solid; }
.ann__num {
  flex: 0 0 auto; width: 20px; height: 20px; border-radius: 999px; background: var(--c-btn-bg); color: #fff;
  font: 600 11px/20px system-ui, sans-serif; text-align: center;
}
.ann__title { flex: 1; border: 1px solid var(--c-border-2); border-radius: 8px; padding: 5px 7px; font-size: 12px; }
.ann__desc {
  width: 100%; margin-top: 6px; border: 1px solid var(--c-border-2); border-radius: 8px;
  padding: 5px 7px; font-size: 12px; font-family: system-ui, sans-serif; resize: vertical; min-height: 44px;
}
.ann__trans { display: flex; gap: 6px; margin-top: 6px; }
.ann__trans-scene {
  flex: 1; min-width: 0; border: 1px solid var(--c-border-2); border-radius: 8px; padding: 4px 6px;
  font-size: 12px; background: var(--c-surface); color: inherit;
}
.ann__trans-cond { flex: 1; min-width: 0; border: 1px solid var(--c-border-2); border-radius: 8px; padding: 4px 6px; font-size: 12px; }
`;
