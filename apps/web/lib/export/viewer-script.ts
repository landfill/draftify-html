import viewerRaw from "../../../../packages/viewer/dist/main.js?raw";

/**
 * 산출물에 인라인할 뷰어 런타임 — **빌드 시점에 문자열로 박아 넣는다.**
 *
 * 왜 `packages/server`의 `readViewerScript()`를 쓰지 않는가:
 * 그쪽은 `fs.readFile(new URL("../../../viewer/dist/main.js", import.meta.url))`로 런타임에 읽는다.
 * Next 번들 컨텍스트에서는 `import.meta.url`이 재작성되고 `URL`이 다른 realm의 클래스가 되어
 * `ERR_INVALID_ARG_TYPE`으로 죽었다(export·/sample 둘 다 500). 서버리스에서는 그 파일이 배포
 * 번들에 포함된다는 보장도 없다. 문자열 인라인은 두 문제를 동시에 없앤다.
 *
 * 전제: `packages/viewer/dist/main.js`가 먼저 빌드돼 있어야 한다(루트 `npm run build`의 tsc -b).
 */
function stripSourceMapComment(source: string): string {
  return source.replace(/\n?\/\/# sourceMappingURL=.*$/g, "");
}

export const VIEWER_SCRIPT: string = stripSourceMapComment(viewerRaw);
