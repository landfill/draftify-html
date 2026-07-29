import sdkRaw from "../../../packages/sdk/dist/sdk.js?raw";

/**
 * `/__mockspec/sdk.js`로 서빙할 SDK 번들 — **빌드 시점에 문자열로 박아 넣는다.**
 *
 * 왜 `packages/server`의 `readSdkBundle()`을 쓰지 않는가:
 * 그쪽은 `createRequire(import.meta.url)` + `require.resolve("@mockspec/sdk/dist/sdk.js")`로 런타임에
 * 경로를 찾고, **실패하면 플레이스홀더 JS를 200으로 돌려준다.** Next 번들 컨텍스트에서는 그 해석이
 * 실패해 실제로 108바이트 플레이스홀더가 서빙됐다 — 편집기가 아예 뜨지 않는데 응답은 200이라
 * 조용히 깨지는 종류의 버그다(W9 DoD가 잡음).
 *
 * 빌드 시점 인라인은 두 가지를 함께 해결한다: 런타임 경로 해석이 없고, 번들이 없으면 **빌드가
 * 실패**해 조용한 폴백이 생기지 않는다. 전제: `packages/sdk/dist/sdk.js`가 먼저 빌드돼 있어야 한다
 * (루트 `npm run build`).
 */
export const SDK_BUNDLE: string = sdkRaw;
