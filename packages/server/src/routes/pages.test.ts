import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { WORKING_NAME } from "@mockspec/shared";
import { buildApp } from "../app.js";
import { CONSOLE_HTML } from "./console.js";

const app = buildApp();

describe("안내 페이지 서빙 — 가이드·FAQ", () => {
  it("루트 도메인 /guide가 사용 가이드 HTML을 반환한다", async () => {
    const res = await request(app).get("/guide").set("Host", "localhost:4000");
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain(`<title>사용 가이드 — ${WORKING_NAME}</title>`);
    // 세 연결 방식(콘솔 탭과 같은 표면 용어)의 기본 구조가 실려 있다
    expect(res.text).toContain("ZIP 업로드");
    expect(res.text).toContain("URL 등록");
    expect(res.text).toContain("내 화면에서 편집");
    expect(res.text).toContain("연결 방식 고르기");
    expect(res.text).toContain("새 화면으로 등록할까요?");
    expect(res.text).toContain("URL이 그대로인 탭·MDI 화면");
  });

  it("루트 도메인 /faq가 FAQ HTML을 반환한다", async () => {
    const res = await request(app).get("/faq").set("Host", "localhost:4000");
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain(`<title>FAQ — ${WORKING_NAME}</title>`);
    expect(res.text).toContain("g-faq-item");
  });

  it("trailing slash가 붙어도 같은 페이지를 반환한다 (/guide/ · /faq/)", async () => {
    const guide = await request(app).get("/guide/").set("Host", "localhost:4000");
    expect(guide.status).toBe(200);
    expect(guide.text).toContain(`<title>사용 가이드 — ${WORKING_NAME}</title>`);
    const faq = await request(app).get("/faq/").set("Host", "localhost:4000");
    expect(faq.status).toBe(200);
  });

  it("안내 페이지에도 공통 헤더·다크 모드 토글이 있고 현재 페이지가 하이라이트된다", async () => {
    const guide = await request(app).get("/guide").set("Host", "localhost:4000");
    expect(guide.text).toContain('href="/faq"');
    expect(guide.text).toContain('id="theme-toggle"');
    expect(guide.text).toContain('href="/guide" class="c-nav-link is-active"');
  });
});

describe("샘플 산출물 서빙 — /sample (이슈 #30)", () => {
  // 산출물 조립은 뷰어 번들을 읽는다 — unit에서는 export.test.ts와 같은 env 스텁 사용
  beforeAll(() => {
    process.env.MOCKSPEC_VIEWER_SCRIPT = "window.__mockspecViewerLoaded = true;";
  });
  afterAll(() => {
    delete process.env.MOCKSPEC_VIEWER_SCRIPT;
  });

  it("루트 도메인 /sample이 데모 산출물 HTML을 인라인으로 반환한다", async () => {
    const res = await request(app).get("/sample").set("Host", "localhost:4000");
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    // 다운로드가 아니라 브라우저에서 바로 열리는 데모
    expect(res.headers["content-disposition"]).toBeUndefined();
    // 산출물 구조 그대로 — spec 임베드 + 화면 3장 스냅샷
    expect(res.text).toContain('id="spec-data"');
    expect(res.text.match(/data-snapshot=/g)).toHaveLength(3);
    expect(res.text).toContain("기획서</title>");
    expect(res.text).toContain("그린마트 주문 관리 (샘플)");
  });

  it("trailing slash가 붙어도 같은 페이지를 반환한다 (/sample/)", async () => {
    const res = await request(app).get("/sample/").set("Host", "localhost:4000");
    expect(res.status).toBe(200);
    expect(res.text).toContain('id="spec-data"');
  });
});

describe("콘솔 헤더 — 링크 활성화·다크 모드 토글", () => {
  it("사용 가이드·FAQ 링크가 /guide·/faq로 활성화돼 있다", () => {
    expect(CONSOLE_HTML).toContain('<a href="/guide" class="c-nav-link">사용 가이드</a>');
    expect(CONSOLE_HTML).toContain('<a href="/faq" class="c-nav-link">FAQ</a>');
  });

  it("죽은 DOCS 링크 대신 샘플 보기(/sample, 새 탭)가 있다 (이슈 #30)", () => {
    expect(CONSOLE_HTML).not.toContain(">DOCS</a>");
    expect(CONSOLE_HTML).toContain('<a href="/sample" class="c-nav-link" target="_blank" rel="noopener">샘플 보기</a>');
  });

  it("EN 링크 대신 다크 모드 토글이 있다", () => {
    expect(CONSOLE_HTML).not.toContain(">EN</a>");
    expect(CONSOLE_HTML).toContain('id="theme-toggle"');
    // 저장된 테마의 첫 페인트 전 적용(FOUC 방지) + 다크 팔레트 선언
    expect(CONSOLE_HTML).toContain("mockspec:theme");
    expect(CONSOLE_HTML).toContain(':root[data-theme="dark"]');
  });
});
