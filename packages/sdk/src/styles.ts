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
}
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
`;
