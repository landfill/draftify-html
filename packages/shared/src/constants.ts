/**
 * 워킹네임·표시 문자열의 단일 관리 지점. (technical-spec §1.3)
 * 워킹네임 "mockspec"은 추후 변경 가능 — 코드 어디에도 하드코딩하지 말고 여기서만 참조한다.
 */

/** 서비스 워킹네임 (레포명·패키지 스코프 겸용). */
export const WORKING_NAME = "mockspec" as const;

/** 서버 예약 경로 접두 — 목업 파일과 충돌 시 이 경로가 우선. (technical-spec §3.2) */
export const RESERVED_PATH_PREFIX = "/__mockspec" as const;

/** 오프라인 편집 큐의 localStorage 키 접두. (ID-05) */
export const PENDING_QUEUE_KEY_PREFIX = "mockspec:pending:" as const;

/** 주입 스크립트 태그가 프로젝트 식별에 쓰는 data 속성명. (ID-03) */
export const PROJECT_DATA_ATTR = "data-project" as const;

/**
 * [S2.5] 주입 스크립트 태그의 transport 지정 속성명. 값 "extension"이면 SDK가
 * same-origin fetch 대신 확장 postMessage 브리지로 API를 호출한다 (pathD 킥오프 §4.2).
 */
export const TRANSPORT_DATA_ATTR = "data-transport" as const;

/** [S2.5] 페이지(SDK) ↔ content script 브리지의 postMessage type 값. */
export const BRIDGE_REQUEST_TYPE = "mockspec:bridge-request" as const;
export const BRIDGE_RESPONSE_TYPE = "mockspec:bridge-response" as const;
