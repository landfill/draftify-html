import type { SpecProject } from "@mockspec/shared";

/** snippet PUT 시 lastSeenOrigin 스탬프 + mockupSource 서버 소유 유지. */
export function applySnippetPutOverrides(
  prev: SpecProject,
  body: SpecProject,
  req: Request,
): SpecProject {
  if (prev.mockupSource.type !== "snippet") return body;
  const pageOrigin = req.headers.get("x-mockspec-page-origin")?.trim();
  return {
    ...body,
    mockupSource: {
      ...prev.mockupSource,
      ...(pageOrigin ? { lastSeenOrigin: pageOrigin } : {}),
    },
  };
}
