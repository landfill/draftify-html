/**
 * Host 헤더 분기 — 오리진을 하드코딩하지 않기 위한 유일한 진입점 (ID-01).
 * `{projectId}.localhost:4000` → projectId, `localhost:4000` → null(콘솔/루트).
 */

/** 프로젝트 id로 허용하는 라벨 형태. ids.ts의 생성 규약(`prj_` + 소문자 영숫자)과 일치. */
const PROJECT_LABEL = /^prj_[0-9a-z]+$/;

/** 서브도메인 라벨이 붙는 루트 도메인. 로컬은 localhost, 배포 시 env로 교체 가능. */
const ROOT_HOST = process.env.MOCKSPEC_ROOT_HOST ?? "localhost";

/**
 * Host 헤더에서 프로젝트 서브도메인을 추출한다.
 * 반환: 프로젝트 id(서브도메인) 또는 null(루트/콘솔).
 */
export function parseProjectSubdomain(hostHeader: string | undefined): string | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.split(":")[0]!.toLowerCase(); // 포트 제거
  const suffix = `.${ROOT_HOST}`;
  if (!hostname.endsWith(suffix)) return null;

  const label = hostname.slice(0, -suffix.length);
  if (!label || label.includes(".")) return null; // 단일 라벨만
  return PROJECT_LABEL.test(label) ? label : null;
}
