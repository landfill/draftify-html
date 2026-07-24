import type { NextFunction, Request, Response } from "express";
import type { SpecProject } from "@mockspec/shared";
import { buildExportHtml, readViewerScript, type SnapshotBundle } from "./export.js";

/**
 * 샘플 산출물 페이지 (/sample) — 이슈 #30.
 *
 * 처음 온 사용자가 내보내기까지 가보기 전에 "결과물이 무엇인지"를 한 클릭으로 보여준다.
 * 정적 파일을 미리 만들어 커밋하는 대신, 아래의 데모 프로젝트 데이터로 실제 export
 * 파이프라인(buildExportHtml + 뷰어 번들)을 요청 시점에 재사용해 조립한다 —
 * 뷰어·산출물 포맷이 바뀌어도 샘플이 낡지 않는다. 결과는 프로세스 내 캐시.
 *
 * 데모 스냅샷은 손으로 쓴 단독 HTML(스크립트 0개, 외부 참조 0건)로 동결본과 같은
 * 성질을 갖는다. 앵커는 데모 마크업의 고유 id 셀렉터라 항상 1단계(selector)로 해석된다.
 */

/** 고정 시각 — 샘플은 항상 같은 산출물이어야 한다 (요청 시각이 새어들지 않게) */
const SAMPLE_GENERATED_AT = "2026-07-19T09:00:00.000Z";

const LOGIN_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>로그인 — 그린마트 주문 관리</title>
<style>
  :root { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2937; font-size: 13px; }
  body { margin: 0; min-height: 100vh; background: #f3f4f6; display: grid; place-items: center; font-size: 13px; }
  .card { width: 320px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 26px 28px; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  h1 { margin: 0 0 4px; font-size: 16px; }
  .sub { margin: 0 0 18px; color: #6b7280; font-size: 12px; }
  label { display: block; margin: 12px 0 5px; font-size: 12px; font-weight: 600; }
  input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12.5px; }
  button { width: 100%; margin-top: 18px; padding: 9px 0; border: 0; border-radius: 6px; background: #059669; color: #fff; font-size: 12.5px; font-weight: 700; }
  .links { margin-top: 13px; text-align: center; font-size: 11.5px; }
  .links a { color: #059669; text-decoration: none; }
</style>
</head>
<body>
  <main class="card">
    <h1>그린마트 주문 관리</h1>
    <p class="sub">사내 계정으로 로그인하세요</p>
    <label for="login-email">이메일</label>
    <input id="login-email" type="email" placeholder="name@greenmart.co.kr">
    <label for="login-password">비밀번호</label>
    <input id="login-password" type="password" placeholder="8자 이상">
    <button id="login-submit" type="button">로그인</button>
    <p class="links"><a id="login-reset" href="#">비밀번호를 잊으셨나요?</a></p>
  </main>
</body>
</html>`;

const ORDERS_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>주문 목록 — 그린마트 주문 관리</title>
<style>
  :root { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2937; font-size: 13px; }
  body { margin: 0; background: #f3f4f6; font-size: 13px; }
  header { background: #059669; color: #fff; padding: 11px 24px; font-size: 13px; font-weight: 700; }
  .wrap { max-width: 960px; margin: 20px auto; padding: 0 20px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
  #order-search { flex: 1; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; }
  #order-filter { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; background: #fff; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-size: 12px; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f3f4f6; }
  thead th { background: #f9fafb; color: #6b7280; font-size: 11px; }
  .badge { padding: 1px 7px; border-radius: 999px; font-size: 10.5px; font-weight: 600; }
  .badge.ready { background: #fef3c7; color: #92400e; }
  .badge.done { background: #d1fae5; color: #065f46; }
</style>
</head>
<body>
  <header>그린마트 주문 관리</header>
  <div class="wrap">
    <div class="toolbar">
      <input id="order-search" type="search" placeholder="주문번호·고객명 검색">
      <select id="order-filter"><option>전체 상태</option><option>배송 준비</option><option>배송 완료</option></select>
    </div>
    <table>
      <thead><tr><th>주문번호</th><th>고객</th><th>금액</th><th>상태</th></tr></thead>
      <tbody>
        <tr id="order-row-1042"><td>#1042</td><td>박서연</td><td>48,900원</td><td><span class="badge ready">배송 준비</span></td></tr>
        <tr><td>#1041</td><td>이도현</td><td>12,300원</td><td><span class="badge done">배송 완료</span></td></tr>
        <tr><td>#1040</td><td>최민준</td><td>67,000원</td><td><span class="badge done">배송 완료</span></td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

const DETAIL_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>주문 상세 — 그린마트 주문 관리</title>
<style>
  :root { font-family: "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2937; font-size: 13px; }
  body { margin: 0; background: #f3f4f6; font-size: 13px; }
  header { background: #059669; color: #fff; padding: 11px 24px; font-size: 13px; font-weight: 700; }
  .wrap { max-width: 680px; margin: 20px auto; padding: 0 20px; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px 24px; }
  h1 { margin: 0 0 14px; font-size: 15px; }
  dl { display: grid; grid-template-columns: 84px 1fr; gap: 8px 14px; margin: 0 0 18px; font-size: 12.5px; }
  dt { color: #6b7280; }
  dd { margin: 0; }
  .actions { display: flex; gap: 8px; }
  #detail-status { padding: 7px 14px; border: 0; border-radius: 6px; background: #059669; color: #fff; font-size: 12px; font-weight: 700; }
  #detail-back { padding: 7px 14px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #374151; font-size: 12px; }
</style>
</head>
<body>
  <header>그린마트 주문 관리</header>
  <div class="wrap">
    <div class="card">
      <h1>주문 #1042</h1>
      <dl>
        <dt>고객</dt><dd>박서연 (010-****-1234)</dd>
        <dt>주문 상품</dt><dd>유기농 채소 세트 외 2건</dd>
        <dt>결제 금액</dt><dd>48,900원</dd>
        <dt>배송 상태</dt><dd>배송 준비</dd>
      </dl>
      <div class="actions">
        <button id="detail-status" type="button">배송 시작으로 변경</button>
        <button id="detail-back" type="button">목록으로</button>
      </div>
    </div>
  </div>
</body>
</html>`;

/**
 * 데모 프로젝트 — 실제 spec.json과 같은 형태 (shared 타입으로 검증).
 * id들은 실물과 같은 "접두_10자" 꼴의 예약값. 앵커 text는 데모 마크업의
 * textSignature(공백 정규화 후 앞 40자)와 정확히 일치해야 파랑(확실) 마커가 된다.
 */
const SAMPLE_PROJECT: SpecProject = {
  version: 1,
  id: "prj_sample0001",
  name: "그린마트 주문 관리 (샘플)",
  ownerLabel: "김기획",
  createdAt: "2026-07-19T08:00:00.000Z",
  updatedAt: SAMPLE_GENERATED_AT,
  mockupSource: {
    type: "upload",
    originalFilename: "greenmart-mockup.zip",
    uploadedAt: "2026-07-19T08:00:00.000Z",
  },
  sceneCodeSeq: 4,
  scenes: [
    {
      id: "scn_sample0001",
      code: "SCR-001",
      title: "로그인",
      route: "/login",
      order: 0,
      annoNumberSeq: 4,
      snapshotAsset: "sample-login",
      frozenAt: SAMPLE_GENERATED_AT,
      captureWidth: 1280,
      captureHeight: 800,
    },
    {
      id: "scn_sample0002",
      code: "SCR-002",
      title: "주문 목록",
      route: "/orders",
      order: 1,
      annoNumberSeq: 4,
      snapshotAsset: "sample-orders",
      frozenAt: SAMPLE_GENERATED_AT,
      captureWidth: 1280,
      captureHeight: 800,
    },
    {
      id: "scn_sample0003",
      code: "SCR-003",
      title: "주문 상세",
      route: "/orders/1042",
      stateNote: "배송 준비 상태의 주문",
      order: 2,
      annoNumberSeq: 3,
      snapshotAsset: "sample-detail",
      frozenAt: SAMPLE_GENERATED_AT,
      captureWidth: 1280,
      captureHeight: 800,
    },
  ],
  annotations: [
    {
      id: "ann_sample0001",
      sceneId: "scn_sample0001",
      number: 1,
      anchor: { selector: "#login-email", rect: { x: 0.36, y: 0.42, w: 0.24, h: 0.05 } },
      title: "이메일 입력",
      description: "사내 계정 이메일만 허용한다.\n\n형식 오류 시 입력창 아래에 **인라인 오류**를 노출하고 포커스를 유지한다.",
      policyRefs: ["POL-001"],
    },
    {
      id: "ann_sample0002",
      sceneId: "scn_sample0001",
      number: 2,
      anchor: { selector: "#login-submit", text: "로그인", rect: { x: 0.36, y: 0.58, w: 0.24, h: 0.05 } },
      title: "로그인 버튼",
      description: "이메일·비밀번호가 모두 채워져야 활성화된다.\n\n인증 성공 시 주문 목록으로 이동한다.",
      transition: { toSceneId: "scn_sample0002", condition: "인증 성공" },
    },
    {
      id: "ann_sample0003",
      sceneId: "scn_sample0001",
      number: 3,
      anchor: { selector: "#login-reset", text: "비밀번호를 잊으셨나요?", rect: { x: 0.42, y: 0.66, w: 0.12, h: 0.03 } },
      title: "비밀번호 재설정 진입",
      description: "재설정 메일 발송 화면은 이번 범위에서 제외 — 문의 채널 안내로 대체한다.",
      policyRefs: ["POL-002"],
    },
    {
      id: "ann_sample0004",
      sceneId: "scn_sample0002",
      number: 1,
      anchor: { selector: "#order-search", rect: { x: 0.14, y: 0.18, w: 0.5, h: 0.05 } },
      title: "주문 검색",
      description: "주문번호·고객명 부분 일치 검색. 입력 후 300ms 디바운스로 조회한다.",
    },
    {
      id: "ann_sample0005",
      sceneId: "scn_sample0002",
      number: 2,
      anchor: { selector: "#order-filter", rect: { x: 0.66, y: 0.18, w: 0.12, h: 0.05 } },
      title: "상태 필터",
      description: "기본값은 `전체 상태`. 선택값은 세션 동안 유지한다.",
      policyRefs: ["POL-010"],
    },
    {
      id: "ann_sample0006",
      sceneId: "scn_sample0002",
      number: 3,
      anchor: { selector: "#order-row-1042", rect: { x: 0.14, y: 0.34, w: 0.72, h: 0.06 } },
      title: "주문 행",
      description: "행 전체가 클릭 영역이다. 클릭 시 해당 주문의 상세로 이동한다.",
      transition: { toSceneId: "scn_sample0003", condition: "행 클릭" },
    },
    {
      id: "ann_sample0007",
      sceneId: "scn_sample0003",
      number: 1,
      anchor: { selector: "#detail-status", text: "배송 시작으로 변경", rect: { x: 0.3, y: 0.56, w: 0.14, h: 0.05 } },
      title: "배송 상태 변경",
      description: "확인 대화상자 없이 즉시 변경하고, 상단에 **실행 취소** 토스트를 5초 노출한다.",
      policyRefs: ["POL-021"],
    },
    {
      id: "ann_sample0008",
      sceneId: "scn_sample0003",
      number: 2,
      anchor: { selector: "#detail-back", text: "목록으로", rect: { x: 0.45, y: 0.56, w: 0.1, h: 0.05 } },
      title: "목록으로 복귀",
      description: "이전 화면의 검색어·필터 상태를 유지한 채 목록으로 돌아간다.",
      transition: { toSceneId: "scn_sample0002" },
    },
  ],
};

function toBundle(sceneId: string, assetKey: string, html: string): SnapshotBundle {
  const buf = Buffer.from(html, "utf8");
  return { sceneId, assetKey, base64: buf.toString("base64"), byteLength: buf.byteLength };
}

// 정적 데모라 모듈 로드 시점에 1회 인코딩 (리뷰 반영)
const SAMPLE_SNAPSHOTS: SnapshotBundle[] = [
  toBundle("scn_sample0001", "sample-login", LOGIN_HTML),
  toBundle("scn_sample0002", "sample-orders", ORDERS_HTML),
  toBundle("scn_sample0003", "sample-detail", DETAIL_HTML),
];

// Promise를 캐시해 최초 동시 요청에도 빌드가 1회만 수행되고, 실패 시 비워 재시도 (리뷰 반영)
let cachedHtml: Promise<string> | undefined;

/** 샘플 산출물 HTML — Express `/sample`과 Next `app/sample`이 공유한다. */
export async function buildSampleHtml(): Promise<string> {
  return buildExportHtml({
    project: SAMPLE_PROJECT,
    snapshots: SAMPLE_SNAPSHOTS,
    viewerScript: await readViewerScript(),
    generatedAt: SAMPLE_GENERATED_AT,
  });
}

/** GET /sample — 산출물 그 자체를 인라인으로 서빙 (다운로드 아님) */
export async function samplePage(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!cachedHtml) {
      cachedHtml = buildSampleHtml().catch((err: unknown) => {
        cachedHtml = undefined;
        throw err;
      });
    }
    res.status(200).type("text/html; charset=utf-8").send(await cachedHtml);
  } catch (err) {
    next(err);
  }
}
