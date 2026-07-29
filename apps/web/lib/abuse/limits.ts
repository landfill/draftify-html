/**
 * W8 남용 방어 한도 — **단일 소스**. 값의 계약은 킥오프 §7.5 표, 사양은 technical-spec §7.4.
 * 값을 바꾸려면 문서(킥오프 §7.5)를 먼저 고친다 (AGENTS.md §4).
 *
 * 사내판(packages/server)의 한도(zip 200MB·asset 50MB)와 의도적으로 다르다 — 공개 멀티테넌트는
 * 무료 Storage(1GB)를 여러 소유자가 나눠 쓴다.
 */

const MB = 1024 * 1024;

export const LIMITS = {
  /** 사용자당 프로젝트 수. */
  maxProjectsPerUser: 20,
  /** 업로드 zip 원본 크기. */
  zipMaxBytes: 50 * MB,
  /** 프로젝트당 목업(해제 후) 총 크기 — zip bomb의 실질 상한. */
  mockupMaxTotalBytes: 50 * MB,
  /** 프로젝트당 목업 파일 수 — complete 검증의 실행시간도 함께 방어. */
  mockupMaxFileCount: 1500,
  /** 스냅샷 asset 1건. */
  snapshotMaxBytes: 25 * MB,
  /** 프로젝트당 asset 총 크기 — 화면 수는 무제한이므로 누적을 여기서 막는다. */
  assetsMaxTotalBytes: 100 * MB,
} as const;

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

/**
 * 레이트리밋 버킷. `write`만 1분 윈도우인 이유: SDK 자동 저장이 500ms 디바운스라
 * 짧은 폭주가 정상 트래픽이고, 시간 단위 총량으로 잡으면 정상 편집을 끊는다.
 */
export const RATE_LIMITS = {
  projectCreate: { limit: 20, windowSeconds: 3600 },
  write: { limit: 120, windowSeconds: 60 },
  export: { limit: 30, windowSeconds: 3600 },
  token: { limit: 20, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateBucket = keyof typeof RATE_LIMITS;

/** 사람이 읽는 크기 — 에러 메시지에만 쓴다. */
export function formatMb(bytes: number): string {
  const mb = bytes / MB;
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}
