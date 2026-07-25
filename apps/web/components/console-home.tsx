"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProjectListItem } from "@mockspec/shared";
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

export function ConsoleHome() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);

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
            빌드 산출물만 압축하세요(최대 {formatMb(LIMITS.zipMaxBytes)}). SPA는 상대 경로 또는 base
            path 빌드를 권장합니다.
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
        <h2 className="c-section-title">
          프로젝트 목록 <span className="c-count">{projects.length || ""}</span>
        </h2>
        {loading ? (
          <p className="c-empty">불러오는 중…</p>
        ) : projects.length === 0 ? (
          <p className="c-empty">아직 프로젝트가 없습니다. ZIP을 업로드해 시작하세요.</p>
        ) : (
          <div className="c-list">
            {projects.map((p) => (
              <div key={p.id} className="c-project">
                <div className="c-project-info">
                  <div className="c-project-title">
                    <a className="c-project-name" href={mockupHref(p.id)}>
                      {p.name}
                    </a>
                    <span className="c-badge">ZIP 업로드</span>
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
                  <a className="c-btn" href={mockupHref(p.id)}>
                    편집 열기
                  </a>
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
