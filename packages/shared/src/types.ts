/**
 * SDK ↔ 서버 ↔ 뷰어 간 유일한 계약. (technical-spec §2)
 *
 * 필드 추가는 자유. 필드 의미 변경은 guide/s1-kickoff-spec.md §11 기록 필수.
 * 표시 코드 체계(SCR-###, POL-### 등)는 docs/output-standard.md §1 참조.
 */

/** 프로젝트 1개 = spec.json 1파일. 이 파일을 그대로 내려주는 것이 export/import(백업)이다. */
export interface SpecProject {
  version: 1;
  /** "prj_" + nanoid(10) */
  id: string;
  name: string;
  /**
   * [T29] 작성자 표시 라벨 — 인증이 아니라 표시·실수 방지용 (POL-M09, FR-CON-03).
   * 콘솔 생성 시 선택 입력. 콘솔 카드·삭제 확인·산출물 헤더에 표시.
   */
  ownerLabel?: string;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  mockupSource: MockupSource;
  /**
   * 다음 SCR-### 번호. 단조 증가 — 삭제된 장면 번호 재사용 방지.
   * max+1 방식은 최고 번호 삭제 후 번호가 재사용되어 재부여 금지 규칙(POL-M14)이 깨진다.
   */
  sceneCodeSeq: number;
  scenes: Scene[];
  annotations: Annotation[];
  /** [S2] 마스킹 규칙 (detailed-spec §3.12). 없으면 마스킹 미사용 */
  maskingRules?: MaskingRule[];
}

/**
 * 온보딩 경로별 목업 출처. A(zip 업로드)=upload, B(URL 프록시)=proxy,
 * D(브라우저 확장 클라이언트 주입)=snippet. (킥오프 s2 §1, pathD §5)
 */
export type MockupSource = UploadMockupSource | ProxyMockupSource | SnippetMockupSource;

export interface UploadMockupSource {
  type: "upload";
  originalFilename: string;
  /** ISO 8601 */
  uploadedAt: string;
}

/** [S2] 경로 B — 등록된 오리진으로 리버스 프록시 (technical-spec §3.3) */
export interface ProxyMockupSource {
  type: "proxy";
  originUrl: string;
  /** ISO 8601 */
  registeredAt: string;
}

/**
 * [S2.5] 경로 D — 브라우저 확장(content script)이 사용자 세션 위에 SDK 주입 (pathD 킥오프 §5).
 * 서버가 fetch할 originUrl이 없다. 저장 인증 토큰은 spec.json에 넣지 않는다 —
 * spec.json은 클라이언트 PUT이 전체 교체하는 파일이라 담으면 덮어쓰기·유출 표면
 * (서버 데이터 디렉토리의 별도 메타 파일에 해시로 저장).
 */
export interface SnippetMockupSource {
  type: "snippet";
  /** ISO 8601 */
  registeredAt: string;
  /** 마지막 저장 요청의 Origin — 참고·표시용. 서버가 저장 시 갱신 */
  lastSeenOrigin?: string;
}

/** [S2] 마스킹 규칙 — 평문 부분 일치 find→replace (정규식 금지, detailed-spec §3.12) */
export interface MaskingRule {
  /** "msk_" + nanoid(10) */
  id: string;
  /** 찾을 문자열 (평문 부분 일치) */
  find: string;
  /** 치환 문자열 (빈 문자열 허용) */
  replace: string;
}

export interface Scene {
  /** "scn_" + nanoid(10) */
  id: string;
  /** "SCR-001" — 생성 순 표시 코드, 영구 불변 (output-standard §1.2) */
  code: string;
  /** 사용자 입력 (패널 인라인 편집. 기본값 document.title은 킥오프 §11 8차에서 철회) */
  title: string;
  /** 등록 시점 location.pathname + search + hash */
  route: string;
  /** "모달 열림 상태" 등 */
  stateNote?: string;
  /** 패널·뷰어 정렬 기준 */
  order: number;
  /** 장면 내 다음 어노테이션 번호. 현재 남은 최대 번호+1 — 끝 번호 삭제 시 감소 가능 */
  annoNumberSeq: number;
  /** asset store 키. 캡처 성공 시에만 존재 */
  snapshotAsset?: string;
  /** ISO 8601 */
  frozenAt?: string;
  /**
   * 캡처 시점 뷰포트 레이아웃 폭(px, documentElement.clientWidth). 뷰어가 스냅샷 iframe의
   * 기준 폭으로 사용 — 반응형 페이지가 캡처 당시 레이아웃(데스크톱/모바일)으로 재현되게.
   * 없으면(구 스냅샷) 뷰어는 중앙 가용 폭으로 폴백.
   */
  captureWidth?: number;
  /**
   * 캡처 시점 뷰포트 높이(px, documentElement.clientHeight). 100vh류(뷰포트 고정 높이)
   * 페이지는 scrollHeight가 항상 뷰포트와 같아 콘텐츠 높이를 측정할 수 없다 — 캡처 당시
   * 높이로 렌더해야 잘리지 않는다. 없으면 뷰어는 최소 480px 폴백.
   */
  captureHeight?: number;
  /** [S2] 마스킹 적용본 asset 키. 원본(snapshotAsset)은 보존 — 규칙 변경 시 원본에서 재생성 */
  maskedSnapshotAsset?: string;
  /** [S2] 마스킹본 생성 시각 (ISO 8601) */
  maskedAt?: string;
}

export interface Annotation {
  /** "ann_" + nanoid(10) */
  id: string;
  sceneId: string;
  /** 장면 내 1부터. 기존 번호는 재정렬하지 않고 신규는 현재 최대+1 */
  number: number;
  anchor: Anchor;
  title: string;
  /** 마크다운 허용 (뷰어에서 렌더) */
  description: string;
  /** "POL-014" 등. S1은 저장·표시만 */
  policyRefs?: string[];
  /**
   * 마커 표시 오프셋(px) — 기본 위치(요소 좌상단, 킥오프 §11 14차 개정)에서 드래그로 옮긴 상대값.
   * 절대 좌표가 아니라 상대값이어야 앵커 재해석(요소 추적)과 공존한다. 킥오프 §11 4차 개정.
   */
  markerOffset?: MarkerOffset;
  /**
   * 흐름도 원천 데이터 — "이 요소 조작 시 → 장면 X로 이동" (FR-EDT-10, 킥오프 §11 7차).
   * 사람이 지정한 전이만 존재한다. 대상 장면 삭제 시 함께 제거된다 (dangling 방지).
   */
  transition?: Transition;
}

/** 장면 간 전이 — scenes + transitions가 방향 그래프가 되어 흐름도로 렌더된다. */
export interface Transition {
  /** 이동할 장면 id (자기 장면 제외 — 전이는 장면 *간* 연결) */
  toSceneId: string;
  /** "성공 시" 등 간선 라벨. 없으면 라벨 없는 화살표 */
  condition?: string;
}

export interface MarkerOffset {
  dx: number;
  dy: number;
}

/**
 * 요소 재식별용 다중 시그니처. (technical-spec §4)
 * data-spec-id는 서비스 모델에서 제외 — 목업 소스를 수정하지 않으므로.
 */
export interface Anchor {
  /** 구조적 CSS 셀렉터 (자동 생성, 클래스 미사용) */
  selector: string;
  /** 요소 textContent 앞 40자 (검증용 시그니처) */
  text?: string;
  /** aria-label, role, name 등 존재하는 것만 */
  attrs?: Record<string, string>;
  /** 문서(document) 기준 비율(0~1), 최후 fallback — ID-04 */
  rect: Rect;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * [T29] 산출물 이력 1건 — 메타 전용, 산출물 HTML은 보관하지 않는다 (technical-spec §6.3).
 * spec.json이 아니라 서버 소유 별도 파일(exports.json)에 쌓인다 —
 * spec.json은 클라이언트 PUT이 전체 교체하는 파일이라 서버 기록이 덮어써진다(토큰과 동일 이유).
 */
export interface ExportRecord {
  /** "exp_" + nanoid(10) */
  id: string;
  /** ISO 8601 — export 시각 */
  createdAt: string;
  /** export 시점 spec의 updatedAt — 어느 판본을 내보냈는지 */
  specUpdatedAt: string;
  /** 산출물 HTML 크기 (bytes) */
  bytes: number;
  /** 마스킹본(maskedSnapshotAsset)이 하나라도 포함됐는지 */
  masked: boolean;
}

/** [T29] GET /projects 목록 항목 — 콘솔 표시용 산출물 이력 요약을 동봉한다. */
export interface ProjectListItem extends SpecProject {
  exportCount: number;
  /** ISO 8601 — 마지막 export 시각. 0회면 없음 */
  lastExportAt?: string;
}
