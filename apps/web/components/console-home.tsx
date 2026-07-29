"use client";

import { useCallback, useEffect, useState } from "react";
import { encodeConnection, type ProjectListItem } from "@mockspec/shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/client.js";
import { LIMITS, formatMb } from "@/lib/abuse/limits.js";
import { uploadMockupZip, completeMockupIntake } from "@/lib/intake/upload.js";
import type { Db } from "@/lib/store/ids.js";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ko-KR");
  } catch {
    return iso;
  }
}

function mockupHref(projectId: string): string {
  return `/m/${projectId}/`;
}

function isSnippet(p: ProjectListItem): boolean {
  return p.mockupSource.type === "snippet";
}

/**
 * 클립보드 복사 — 실패하면 prompt로 값을 보여 준다(사용자가 직접 복사할 수 있게).
 * 연결 코드는 재발급 없이 다시 만들 수 없으므로, 복사 실패로 값을 잃게 두지 않는다.
 */
async function copyOrPrompt(text: string, promptLabel: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt(promptLabel, text);
    return false;
  }
}

export function ConsoleHome() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [snippetStatus, setSnippetStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );
  const [creatingSnippet, setCreatingSnippet] = useState(false);
  /**
   * 이 세션에서 발급·재발급한 평문 토큰. 서버는 해시만 보관하므로 새로고침하면 사라진다 —
   * 그때는 [토큰 재발급]으로 새 코드를 받는다(기존 토큰은 즉시 무효).
   */
  const [sessionTokens, setSessionTokens] = useState<Record<string, string>>({});

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error("목록을 불러오지 못했습니다.");
    setProjects((await res.json()) as ProjectListItem[]);
  }, []);

  useEffect(() => {
    loadProjects()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [loadProjects]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadStatus(null);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const ownerLabel = (form.elements.namedItem("ownerLabel") as HTMLInputElement).value.trim();
    const fileInput = form.elements.namedItem("zip") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setUploadStatus({ kind: "error", text: "zip 파일을 선택해 주세요." });
      return;
    }
    if (file.size > LIMITS.zipMaxBytes) {
      setUploadStatus({
        kind: "error",
        text: `zip 파일이 ${formatMb(LIMITS.zipMaxBytes)} 제한을 초과합니다.`,
      });
      return;
    }

    setUploading(true);
    let createdProjectId: string | null = null;
    try {
      const createRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || file.name.replace(/\.zip$/i, ""),
          originalFilename: file.name,
          ...(ownerLabel ? { ownerLabel } : {}),
        }),
      });
      const createBody = (await createRes.json()) as {
        project?: { id: string };
        error?: { message: string };
      };
      if (!createRes.ok) throw new Error(createBody.error?.message ?? "프로젝트 생성 실패");

      const projectId = createBody.project!.id;
      createdProjectId = projectId;
      const supabase = createSupabaseBrowserClient() as unknown as Db;
      const { manifest, extract } = await uploadMockupZip(supabase, projectId, file);
      const { mockupUrl } = await completeMockupIntake(projectId, manifest);

      const excluded =
        extract.excluded.length > 0
          ? ` 제외: ${extract.excluded.map((x) => `${x.pattern} ${x.count}건`).join(", ")}.`
          : "";
      const stripped = extract.strippedRoot ? ` 최상위 폴더 '${extract.strippedRoot}' 언랩.` : "";

      setUploadStatus({
        kind: "ok",
        text: `업로드 완료 (${extract.fileCount}개 파일).${stripped}${excluded} `,
      });
      createdProjectId = null; // 여기까지 오면 목업이 활성화됐다 — 정리 대상이 아니다.
      form.reset();
      await loadProjects();

      const link = document.createElement("a");
      link.href = mockupUrl;
      link.textContent = "편집 열기 →";
      const statusEl = document.getElementById("upload-status");
      if (statusEl) {
        statusEl.appendChild(document.createTextNode(" "));
        statusEl.appendChild(link);
      }
    } catch (err) {
      // 목업이 활성화되지 못한 프로젝트는 남겨 두면 프로젝트 수 쿼터와 Storage만 잡아먹는다(W8).
      // 편집이 불가능한 껍데기라 삭제해도 잃을 것이 없다.
      if (createdProjectId) {
        await fetch(`/api/projects/${createdProjectId}`, { method: "DELETE" }).catch(
          () => undefined,
        );
      }
      setUploadStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "업로드에 실패했습니다.",
      });
      await loadProjects().catch(() => undefined);
    } finally {
      setUploading(false);
    }
  }

  /** 경로 D 프로젝트 생성 — 응답의 평문 토큰으로 즉시 연결 코드를 만들어 복사한다. */
  async function handleCreateSnippet(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSnippetStatus(null);
    const form = e.currentTarget;
    const name = (form.elements.namedItem("snippetName") as HTMLInputElement).value.trim();
    const ownerLabel = (
      form.elements.namedItem("snippetOwnerLabel") as HTMLInputElement
    ).value.trim();
    if (!name) {
      setSnippetStatus({ kind: "error", text: "프로젝트 이름을 입력해 주세요." });
      return;
    }

    setCreatingSnippet(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "snippet", name, ...(ownerLabel ? { ownerLabel } : {}) }),
      });
      const body = (await res.json()) as {
        project?: { id: string };
        token?: string;
        error?: { message: string };
      };
      if (!res.ok || !body.project || !body.token) {
        throw new Error(body.error?.message ?? "프로젝트 생성에 실패했습니다.");
      }

      const projectId = body.project.id;
      setSessionTokens((prev) => ({ ...prev, [projectId]: body.token! }));
      const code = encodeConnection({
        projectId,
        token: body.token,
        serverUrl: window.location.origin,
      });
      const copied = await copyOrPrompt(code, "연결 코드 (복사해 확장 팝업에 붙여넣으세요):");
      setSnippetStatus({
        kind: "ok",
        text: copied
          ? "프로젝트를 만들고 연결 코드를 복사했습니다 — 확장 팝업에 붙여넣고 [연결]을 누르세요."
          : "프로젝트를 만들었습니다. 표시된 연결 코드를 복사해 확장 팝업에 붙여넣으세요.",
      });
      form.reset();
      await loadProjects();
    } catch (err) {
      setSnippetStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "프로젝트 생성에 실패했습니다.",
      });
    } finally {
      setCreatingSnippet(false);
    }
  }

  /** 이 세션에 평문 토큰이 있을 때만 연결 코드를 다시 만들 수 있다. */
  async function handleCopyConnection(p: ProjectListItem) {
    const token = sessionTokens[p.id];
    if (!token) {
      setSnippetStatus({
        kind: "error",
        text: `'${p.name}'의 토큰이 이 세션에 없습니다 — [토큰 재발급]을 누르면 새 연결 코드가 만들어집니다.`,
      });
      return;
    }
    const code = encodeConnection({ projectId: p.id, token, serverUrl: window.location.origin });
    const copied = await copyOrPrompt(code, "연결 코드 (복사해 확장 팝업에 붙여넣으세요):");
    setSnippetStatus({
      kind: "ok",
      text: copied ? "연결 코드를 복사했습니다." : "표시된 연결 코드를 복사하세요.",
    });
  }

  async function handleReissueToken(p: ProjectListItem) {
    if (
      !confirm(
        `'${p.name}'의 토큰을 재발급하면 기존 토큰이 즉시 무효화됩니다.\n확장도 새 연결 코드로 다시 연결해야 합니다. 계속할까요?`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/projects/${p.id}/token`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as {
      token?: string;
      error?: { message: string };
    };
    if (!res.ok || !body.token) {
      setSnippetStatus({
        kind: "error",
        text: body.error?.message ?? "토큰 재발급에 실패했습니다.",
      });
      return;
    }
    setSessionTokens((prev) => ({ ...prev, [p.id]: body.token! }));
    const code = encodeConnection({
      projectId: p.id,
      token: body.token,
      serverUrl: window.location.origin,
    });
    const copied = await copyOrPrompt(code, "새 연결 코드 (복사해 확장 팝업에 붙여넣으세요):");
    setSnippetStatus({
      kind: "ok",
      text: copied
        ? "토큰을 재발급하고 새 연결 코드를 복사했습니다 — 확장 팝업에 붙여넣고 [연결]."
        : "토큰을 재발급했습니다. 표시된 연결 코드로 다시 연결하세요.",
    });
  }

  async function handleDelete(p: ProjectListItem) {
    const owner = p.ownerLabel ? ` (작성자: ${p.ownerLabel})` : "";
    if (!confirm(`'${p.name}'${owner} 프로젝트를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message: string } };
      alert(body.error?.message ?? "삭제에 실패했습니다.");
      return;
    }
    await loadProjects();
  }

  return (
    <main className="c-shell">
      <section className="c-card">
        <h2 className="c-section-title">새 프로젝트 — ZIP 업로드</h2>
        <form onSubmit={(e) => void handleUpload(e)}>
          <div className="c-row">
            <label htmlFor="project-name">프로젝트 이름</label>
            <input id="project-name" name="name" type="text" placeholder="비우면 zip 파일명 사용" />
          </div>
          <div className="c-row">
            <label htmlFor="project-owner">작성자 라벨</label>
            <input id="project-owner" name="ownerLabel" type="text" placeholder="선택 — 산출물·목록에 표시" />
          </div>
          <div className="c-row">
            <label htmlFor="project-zip">ZIP 파일</label>
            <input id="project-zip" name="zip" type="file" accept=".zip,application/zip" required />
          </div>
          <p className="c-hint">
            빌드 산출물만 압축하세요(최대 {formatMb(LIMITS.zipMaxBytes)}).{" "}
            <b>반드시 상대 경로로 빌드해야 합니다</b> — 목업은 <code>/m/{"{id}"}/</code> 아래에서
            열리므로 <code>/assets/…</code> 같은 절대 경로는 찾지 못해 화면이 비어 보입니다. Vite는{" "}
            <code>--base=./</code>, CRA는 <code>&quot;homepage&quot;: &quot;.&quot;</code>.
          </p>
          <button type="submit" className="c-btn" disabled={uploading}>
            {uploading ? "업로드 중…" : "업로드"}
          </button>
        </form>
        {uploadStatus ? (
          <p id="upload-status" className={`c-status is-${uploadStatus.kind}`}>
            {uploadStatus.text}
          </p>
        ) : null}
      </section>

      <section className="c-card">
        <h2 className="c-section-title">새 프로젝트 — 내 화면에서 편집 (확장)</h2>
        <p className="c-hint">
          로그인해야 보이는 화면·사내 시스템처럼 <b>zip으로 만들 수 없는 목업</b>에 씁니다. 서버는
          그 화면에 접근하지 않고, Chrome 확장이 <b>내 브라우저 화면 위에</b> 편집기를 얹습니다.
          프로젝트를 만들면 <b>연결 코드</b>가 복사되고, 그 코드를 확장 팝업에 붙여넣어 연결합니다.
        </p>
        <form onSubmit={(e) => void handleCreateSnippet(e)}>
          <div className="c-row">
            <label htmlFor="snippet-name">프로젝트 이름</label>
            <input id="snippet-name" name="snippetName" type="text" placeholder="필수" required />
          </div>
          <div className="c-row">
            <label htmlFor="snippet-owner">작성자 라벨</label>
            <input
              id="snippet-owner"
              name="snippetOwnerLabel"
              type="text"
              placeholder="선택 — 산출물·목록에 표시"
            />
          </div>
          <p className="c-hint">
            연결 코드에는 <b>토큰이 들어 있습니다</b> — 코드를 공유하면 그 프로젝트 쓰기 권한을
            공유하는 것과 같습니다. 코드는 발급 시 한 번만 만들어지며, 이 페이지를 새로고침하면
            다시 만들 수 없습니다(그때는 [토큰 재발급]).
          </p>
          <button type="submit" className="c-btn" disabled={creatingSnippet}>
            {creatingSnippet ? "만드는 중…" : "만들고 연결 코드 복사"}
          </button>
        </form>
        {snippetStatus ? (
          <p className={`c-status is-${snippetStatus.kind}`}>{snippetStatus.text}</p>
        ) : null}
      </section>

      <section className="c-card">
        <h2 className="c-section-title">
          프로젝트 목록 <span className="c-count">{projects.length || ""}</span>
        </h2>
        {loading ? (
          <p className="c-empty">불러오는 중…</p>
        ) : projects.length === 0 ? (
          <p className="c-empty">
            아직 프로젝트가 없습니다. ZIP을 업로드하거나, 확장으로 내 화면을 연결해 시작하세요.
          </p>
        ) : (
          <div className="c-list">
            {projects.map((p) => (
              <div key={p.id} className="c-project">
                <div className="c-project-info">
                  <div className="c-project-title">
                    {isSnippet(p) ? (
                      // 경로 D는 서버에 목업이 없다 — 편집은 확장이 붙은 그 화면에서 한다.
                      <span className="c-project-name">{p.name}</span>
                    ) : (
                      <a className="c-project-name" href={mockupHref(p.id)}>
                        {p.name}
                      </a>
                    )}
                    <span className="c-badge">
                      {isSnippet(p) ? "확장 — 내 화면에서 편집" : "ZIP 업로드"}
                    </span>
                  </div>
                  <div className="c-project-meta">
                    {[
                      p.ownerLabel,
                      `화면 ${p.scenes.length}개`,
                      `어노테이션 ${p.annotations.length}개`,
                      formatDate(p.updatedAt),
                      p.exportCount > 0
                        ? `보내기 ${p.exportCount}회`
                        : undefined,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <div className="c-project-actions">
                  {isSnippet(p) ? (
                    <>
                      <button
                        type="button"
                        className="c-btn"
                        onClick={() => void handleCopyConnection(p)}
                        title={
                          sessionTokens[p.id]
                            ? "확장 팝업에 붙여넣을 연결 코드를 복사합니다"
                            : "이 세션에 토큰이 없습니다 — [토큰 재발급]을 먼저 누르세요"
                        }
                      >
                        연결 코드 복사
                      </button>
                      <button
                        type="button"
                        className="c-btn"
                        onClick={() => void handleReissueToken(p)}
                      >
                        토큰 재발급
                      </button>
                    </>
                  ) : (
                    <a className="c-btn" href={mockupHref(p.id)}>
                      편집 열기
                    </a>
                  )}
                  <button
                    type="button"
                    className="c-btn c-btn-danger"
                    onClick={() => void handleDelete(p)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
