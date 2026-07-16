/**
 * SDK UI 스타일. Shadow DOM 안에서만 적용되므로 목업 CSS와 충돌하지 않는다.
 * 별도 .css를 만들지 않고 문자열로 두는 이유: 번들을 단일 sdk.js로 유지 (technical-spec §1.2).
 */
export const STYLES = /* css */ `
:host, * { box-sizing: border-box; }

.fab {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  width: 52px; height: 52px; border-radius: 50%; border: none;
  background: #2f6feb; color: #fff; font-size: 22px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,.28);
  display: flex; align-items: center; justify-content: center;
  font-family: system-ui, sans-serif;
}
.fab:hover { background: #2559c9; }

.panel {
  position: fixed; top: 0; right: 0; bottom: 0; width: 360px; z-index: 2147483000;
  background: #fff; color: #1a1a1a; border-left: 1px solid #e2e2e2;
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
  width: 26px; height: 88px; border: 1px solid #d5d5d5; border-right: none;
  border-radius: 10px 0 0 10px; background: rgba(255,255,255,.94); color: #2f6feb;
  font-size: 13px; cursor: pointer; box-shadow: -2px 2px 10px rgba(0,0,0,.15);
  font-family: system-ui, sans-serif;
}
.panel-tab:hover { background: #eef3ff; }
/* 선택 항목의 마커가 패널 뒤에 있을 때의 안내 (이슈 #8) */
.ann__hidden {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  margin-top: 6px; padding: 6px 8px; border-radius: 6px;
  background: #fff4e5; color: #b5560a; font-size: 11px; line-height: 1.4;
}
.ann__hidden .btn { flex: 0 0 auto; }
/* head·seg 아래 내용의 스크롤 영역 — 어노테이션이 늘어나도 끝까지 접근 가능해야 한다 */
.panel__body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
/* 패널 하단 고정 — 내보내기 (§3.9) */
.panel__foot { flex: 0 0 auto; padding: 10px 14px; border-top: 1px solid #eee; }
.btn--export { width: 100%; padding: 8px; font-size: 12px; font-weight: 600; }
.btn--export:disabled { opacity: .5; cursor: default; }
.panel__head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid #eee;
}
.panel__title { font-weight: 600; font-size: 13px; flex: 0 0 auto; }
.panel__pid { color: #888; font-size: 11px; font-family: ui-monospace, monospace; }
.panel__spacer { flex: 1 1 auto; }
.panel__close {
  border: none; background: transparent; cursor: pointer; font-size: 18px;
  color: #666; line-height: 1; padding: 2px 6px;
}
.panel__close:hover { color: #111; }
.save {
  flex: 0 1 auto; min-width: 0; max-width: 128px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; font-size: 11px; color: #666;
}
.save--saved { color: #2b8a3e; }
.save--saving, .save--loading { color: #7a7a7a; }
.save--offline, .save--error { color: #c92a2a; }

.seg { display: flex; margin: 12px 14px; border: 1px solid #d5d5d5; border-radius: 8px; overflow: hidden; }
.seg button {
  flex: 1; border: none; background: #fafafa; padding: 8px 0; cursor: pointer;
  font-size: 12px; color: #555;
}
.seg button.active { background: #2f6feb; color: #fff; font-weight: 600; }

.hint {
  margin: 0 14px 12px; padding: 8px 10px; border-radius: 6px;
  background: #f4f7ff; color: #3355aa; font-size: 12px; line-height: 1.5;
}
.section { padding: 12px 14px; border-top: 1px solid #f0f0f0; }
.section h4 { margin: 0 0 6px; font-size: 12px; color: #333; }
.section .muted { color: #999; font-size: 12px; }

.status { margin-left: auto; font-size: 11px; color: #7a7a7a; }

/* 편집 모드 요소 하이라이트 (viewport 좌표, 클릭 통과) */
.hl {
  position: fixed; z-index: 2147482000; pointer-events: none;
  border: 2px solid #2f6feb; background: rgba(47,111,235,.08);
  border-radius: 3px; transition: all .04s linear;
}

/* 숫자 마커 (요소 좌상단, viewport 좌표) */
.marker {
  position: fixed; z-index: 2147482500; transform: translate(-50%, -50%);
  min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px;
  border: 2px solid #fff; background: #2f6feb; color: #fff;
  font: 600 11px/16px system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.35);
  touch-action: none; /* 포인터 드래그(마커 이동)용 */
}
.marker--drag { cursor: grabbing; }
.marker--sel { background: #d9480f; }
.marker--uncertain { background: #999; border-style: dashed; }
.marker--empty { opacity: .65; } /* 미작성 핀 — 내용이 비어 있음을 구분 표시 */

.row { display: flex; align-items: center; gap: 6px; }
.row h4 { flex: 1; }
.btn {
  border: 1px solid #2f6feb; background: #eef3ff; color: #2f6feb;
  border-radius: 6px; padding: 5px 8px; font-size: 11px; cursor: pointer;
}
.btn:hover { background: #dfe8ff; }
.btn:disabled { opacity: .45; cursor: default; }
.btn:disabled:hover { background: #eef3ff; }

.hint--warn { background: #fff4e5; color: #b5560a; }

.list { list-style: none; margin: 8px 0 0; padding: 0; }
.scene { margin-bottom: 6px; }
.scene__row { display: flex; align-items: center; gap: 4px; }
.scene__pick {
  flex: 0 0 auto; text-align: left; border: 1px solid #e2e2e2; background: #fafafa;
  border-radius: 6px; padding: 6px 8px; cursor: pointer; font-size: 12px; color: #333;
}
.scene--cur .scene__pick { border-color: #2f6feb; background: #eef3ff; }
.scene__code { font: 600 11px ui-monospace, monospace; color: #2f6feb; }
.scene__title {
  flex: 1; min-width: 0; border: 1px solid #ddd; border-radius: 6px;
  padding: 5px 7px; font-size: 12px;
}
.scene--cur .scene__title { border-color: #bcd0f7; }
.scene__refreeze {
  border: 1px solid #d5d5d5; background: #fafafa; color: #666; cursor: pointer;
  font-size: 13px; line-height: 1; border-radius: 6px; padding: 4px 6px;
}
.scene__refreeze:hover:not(:disabled) { border-color: #2f6feb; color: #2f6feb; }
.scene__refreeze:disabled { opacity: .4; cursor: default; }
.scene__del, .ann__del {
  border: none; background: transparent; color: #bbb; cursor: pointer; font-size: 15px; padding: 2px 5px;
}
.scene__del:hover, .ann__del:hover { color: #d9480f; }

/* 캡처 상태 (장면 항목 하단) */
.scene__frz { margin: 3px 0 0 2px; font-size: 11px; }
.frz { display: inline-flex; align-items: center; gap: 5px; }
.frz--busy { color: #7a7a7a; }
.frz--ok { color: #2b8a3e; }
.frz--none { color: #aaa; }
.frz--err {
  border: 1px solid #f3b0b0; background: #fff0f0; color: #c92a2a;
  border-radius: 5px; padding: 2px 7px; cursor: pointer; font-size: 11px;
}
.frz--err:hover { background: #ffe3e3; }
.spin {
  width: 11px; height: 11px; border-radius: 50%;
  border: 2px solid #cfd6e4; border-top-color: #2f6feb;
  display: inline-block; animation: mockspec-spin .7s linear infinite;
}
@keyframes mockspec-spin { to { transform: rotate(360deg); } }

.ann { border: 1px solid #eee; border-radius: 6px; padding: 8px; margin-top: 6px; }
.ann--empty { border-style: dashed; border-color: #ccc; background: #fafafa; } /* 미작성 핀 */
.ann--sel { border-color: #d9480f; border-style: solid; }
.ann__num {
  flex: 0 0 auto; width: 20px; height: 20px; border-radius: 10px; background: #2f6feb; color: #fff;
  font: 600 11px/20px system-ui, sans-serif; text-align: center;
}
.ann__title { flex: 1; border: 1px solid #ddd; border-radius: 4px; padding: 5px 7px; font-size: 12px; }
.ann__desc {
  width: 100%; margin-top: 6px; border: 1px solid #ddd; border-radius: 4px;
  padding: 5px 7px; font-size: 12px; font-family: system-ui, sans-serif; resize: vertical; min-height: 44px;
}
.ann__trans { display: flex; gap: 6px; margin-top: 6px; }
.ann__trans-scene {
  flex: 1; min-width: 0; border: 1px solid #ddd; border-radius: 4px; padding: 4px 6px;
  font-size: 12px; background: #fff; color: inherit;
}
.ann__trans-cond { flex: 1; min-width: 0; border: 1px solid #ddd; border-radius: 4px; padding: 4px 6px; font-size: 12px; }
`;
