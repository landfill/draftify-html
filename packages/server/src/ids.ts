import { customAlphabet } from "nanoid";

/**
 * ID 생성기. 접두 규약은 데이터 모델(shared/types.ts) 주석과 일치시킨다.
 *
 * 알파벳을 소문자 영숫자로 고정하는 이유: 프로젝트 id가 서브도메인 라벨
 * (`{projectId}.localhost`)로 쓰인다. 호스트명은 대소문자 구분이 없으므로
 * nanoid 기본 알파벳(대문자·`_`·`-` 포함)을 쓰면 Host 헤더 매칭에서
 * 케이스 폴딩 모호성이 생긴다. 소문자 영숫자면 그 문제가 없다. (technical-spec §3.1)
 */
const nano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const makeProjectId = (): string => `prj_${nano()}`;
export const makeSceneId = (): string => `scn_${nano()}`;
export const makeAnnotationId = (): string => `ann_${nano()}`;
