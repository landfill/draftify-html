import path from "node:path";

/**
 * 디스크 저장 레이아웃. 모든 상태는 `data/` 아래에만 둔다 (AGENTS.md §5, ID-14).
 * 경로도 오리진과 마찬가지로 env(`MOCKSPEC_DATA_DIR`)로 뺀다 — 기본은 cwd의 data/.
 * env를 매번 읽는(지연 평가) 이유: 테스트가 프로세스마다 임시 디렉토리로 교체할 수 있어야 한다.
 */
export const dataDir = (): string =>
  process.env.MOCKSPEC_DATA_DIR ?? path.resolve(process.cwd(), "data");

export const projectsRoot = (): string => path.join(dataDir(), "projects");
export const projectDir = (id: string): string => path.join(projectsRoot(), id);

/** zip 해제 결과(정적 서빙 루트). */
export const mockupDir = (id: string): string => path.join(projectDir(id), "mockup");

/** SpecProject 직렬화 파일. 이 파일을 그대로 내려주는 것이 export/import(백업). */
export const specFile = (id: string): string => path.join(projectDir(id), "spec.json");

/** 캡처 스냅샷 등 asset store. */
export const assetsDir = (id: string): string => path.join(projectDir(id), "assets");

/**
 * [S2.5] 경로 D 저장 인증 토큰 메타(해시만 보관). spec.json 밖에 두는 이유:
 * spec.json은 클라이언트 PUT이 전체 교체하는 파일이라 토큰을 담으면
 * 덮어쓰기·응답 유출 표면이 된다 (pathD 킥오프 §8-2).
 */
export const tokenFile = (id: string): string => path.join(projectDir(id), "token.json");

/**
 * [T29] 산출물 이력(메타 전용 — technical-spec §6.3). spec.json 밖에 두는 이유는
 * 토큰과 동일: 클라이언트 PUT의 전체 교체가 서버 기록을 덮어쓴다.
 */
export const exportsFile = (id: string): string => path.join(projectDir(id), "exports.json");
