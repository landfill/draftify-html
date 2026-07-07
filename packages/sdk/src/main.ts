/**
 * Spec Editor SDK 진입점 (Preact, Shadow DOM). — technical-spec §1.3, §3
 * T1은 스캐폴딩만. 실제 mount·모드 전환은 T4에서 구현.
 */
import { PROJECT_DATA_ATTR, type SpecProject } from "@mockspec/shared";

/** 주입 스크립트 태그의 data-project 속성에서 자기 프로젝트 id를 읽는다. (ID-03) */
export function readProjectId(): string | null {
  const current = document.currentScript as HTMLScriptElement | null;
  return current?.getAttribute(PROJECT_DATA_ATTR) ?? null;
}

/** T4에서 채운다. 지금은 계약(타입)이 3패키지에 연결됨을 증명하는 자리표시. */
export function mount(_project: SpecProject): void {
  throw new Error("not implemented (T4)");
}
