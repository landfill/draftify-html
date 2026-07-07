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
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
  mockupSource: MockupSource;
  /**
   * 다음 SCR-### 번호. 단조 증가 — 삭제된 장면 번호 재사용 방지.
   * max+1 방식은 최고 번호 삭제 후 번호가 재사용되어 재부여 금지 규칙(POL-M02·M14)이 깨진다.
   */
  sceneCodeSeq: number;
  scenes: Scene[];
  annotations: Annotation[];
}

/** S1은 업로드 경로만. S2에서 프록시/빌드 경로 추가 예정. */
export interface MockupSource {
  type: "upload";
  originalFilename: string;
  /** ISO 8601 */
  uploadedAt: string;
}

export interface Scene {
  /** "scn_" + nanoid(10) */
  id: string;
  /** "SCR-001" — 생성 순 표시 코드, 영구 불변 (output-standard §1.2) */
  code: string;
  /** 사용자 입력, 기본값 document.title */
  title: string;
  /** 등록 시점 location.pathname + search + hash */
  route: string;
  /** "모달 열림 상태" 등 */
  stateNote?: string;
  /** 패널·뷰어 정렬 기준 */
  order: number;
  /** 장면 내 다음 어노테이션 번호. 단조 증가 — 삭제 시 재부여 금지 규칙의 구현 */
  annoNumberSeq: number;
  /** asset store 키. 동결 성공 시에만 존재 */
  snapshotAsset?: string;
  /** ISO 8601 */
  frozenAt?: string;
}

export interface Annotation {
  /** "ann_" + nanoid(10) */
  id: string;
  sceneId: string;
  /** 장면 내 1부터. 삭제 시 재부여 금지 */
  number: number;
  anchor: Anchor;
  title: string;
  /** 마크다운 허용 (뷰어에서 렌더) */
  description: string;
  /** "POL-014" 등. S1은 저장·표시만 */
  policyRefs?: string[];
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
