import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import request from "supertest";
import JSZip from "jszip";
import { WORKING_NAME } from "@mockspec/shared";
import { buildApp } from "../app.js";
import { CONSOLE_HTML } from "./console.js";

const app = buildApp();

async function zipOf(entries: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [p, content] of Object.entries(entries)) zip.file(p, content);
  return zip.generateAsync({ type: "nodebuffer" });
}

let tmp: string;
beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "mockspec-console-"));
  process.env.MOCKSPEC_DATA_DIR = tmp;
});
afterEach(async () => {
  delete process.env.MOCKSPEC_DATA_DIR;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("콘솔 페이지 서빙 (T9)", () => {
  it("루트 도메인 /가 콘솔 HTML을 반환한다", async () => {
    const res = await request(app).get("/").set("Host", "localhost:4000");
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain(`<title>${WORKING_NAME} 콘솔</title>`);
    expect(res.text).toContain('id="upload-form"');
    expect(res.text).toContain('id="project-list"');
  });

  it("온보딩 폼이 3택이다 — zip·URL·확장(경로 D, T21)", async () => {
    const res = await request(app).get("/").set("Host", "localhost:4000");
    expect(res.text).toContain('id="url-form"');
    expect(res.text).toContain('id="snippet-form"');
    expect(res.text).toContain("내 화면에서 편집 (확장)");
  });

  it("확장 프로젝트 카드에 ID 표시·연결 코드 복사가 있다 (실사용: 이름/ID 혼동·팝업 소실 방지)", () => {
    // 클라이언트 렌더(CONSOLE_JS)에 snippet 전용 ID 행·연결 코드 인코더·복사 핸들러 포함 확인
    expect(CONSOLE_HTML).toContain("c-project-id");
    expect(CONSOLE_HTML).toContain("연결 코드 복사");
    expect(CONSOLE_HTML).toContain("encodeConnection");
  });

  it("인라인 콘솔 JS가 문법 오류 없이 파싱된다 (템플릿 리터럴 내 raw 개행 등 회귀 방지)", () => {
    // CONSOLE_JS는 TS 템플릿 리터럴이라 JS 문자열 안 개행은 `\\n`으로 써야 한다.
    // `"\n"`을 잘못 쓰면 빌드 시 실제 개행이 되어 인라인 스크립트 전체가 깨진다(실사용에서 발견).
    const m = /<script>([\s\S]*?)<\/script>\s*<\/body>/.exec(CONSOLE_HTML);
    expect(m, "인라인 콘솔 스크립트 블록").not.toBeNull();
    // new Function으로 파싱만 확인(실행하지 않음) — 문법 오류면 여기서 throw
    expect(() => new Function(m![1]!)).not.toThrow();
  });

  it("콘솔 HTML은 외부 참조 없이 상대 /api 경로만 호출한다 (ID-01)", () => {
    // 오리진 하드코딩 금지 — http(s) 절대 URL이 없어야 한다 (SPA base 안내 문구 제외)
    expect(CONSOLE_HTML).not.toMatch(/(?:src|href)="https?:\/\//);
    expect(CONSOLE_HTML).toContain('fetch("/api/projects"');
  });

  it("서브도메인 /는 콘솔이 아니라 목업 서빙으로 간다", async () => {
    const res = await request(app).get("/").set("Host", "prj_none123.localhost:4000");
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('id="upload-form"');
  });
});

describe("업로드 검증 (detailed-spec §2.2·§6)", () => {
  it("루트에 index.html이 없으면 400으로 거부하고 프로젝트를 남기지 않는다", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Host", "localhost:4000")
      .field("name", "인덱스 없음")
      .attach("zip", await zipOf({ "assets/app.js": "1" }), "noindex.zip");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REQUEST");
    expect(res.body.error.message).toContain("index.html");

    const list = await request(app).get("/api/projects").set("Host", "localhost:4000");
    expect(list.body).toEqual([]);
  });

  it("zip-slip 거부 시에도 빈 프로젝트가 정리된다", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Host", "localhost:4000")
      .field("name", "탈출 시도")
      .attach("zip", await zipOf({ "../evil.txt": "pwned" }), "slip.zip");
    expect(res.status).toBe(400);

    const list = await request(app).get("/api/projects").set("Host", "localhost:4000");
    expect(list.body).toEqual([]);
  });

  it("dist 폴더째 압축한 zip은 최상위 폴더를 벗겨 정상 업로드된다", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Host", "localhost:4000")
      .field("name", "폴더째 압축")
      .attach(
        "zip",
        await zipOf({ "dist/index.html": "<html><body>ok</body></html>", "dist/app.js": "1" }),
        "dist.zip",
      );
    expect(res.status).toBe(201);
    expect(res.body.extract.strippedRoot).toBe("dist");

    // 언랩된 루트에서 목업이 서빙된다
    const id = res.body.project.id as string;
    const page = await request(app).get("/").set("Host", `${id}.localhost:4000`);
    expect(page.status).toBe(200);
    expect(page.text).toContain("ok");
  });

  it("zip이 아닌 파일은 400 '(zip 파일을 확인해주세요)'로 거부한다", async () => {
    const res = await request(app)
      .post("/api/projects")
      .set("Host", "localhost:4000")
      .field("name", "깨진 zip")
      .attach("zip", Buffer.from("not a zip"), "broken.zip");
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("zip 파일을 확인해주세요");

    const list = await request(app).get("/api/projects").set("Host", "localhost:4000");
    expect(list.body).toEqual([]);
  });
});
