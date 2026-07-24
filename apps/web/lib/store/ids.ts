import { customAlphabet } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types.js";

/** 요청 스코프 또는 관리 Supabase 클라이언트. 스토어 어댑터는 어느 쪽이든 받는다. */
export type Db = SupabaseClient<Database>;

/** 목업·asset을 담는 단일 비공개 버킷 (마이그레이션 §5와 일치). */
export const STORAGE_BUCKET = "mockups";

const lower = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);
const assetNano = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

/** 프로젝트 ID = spec.id. 기존 파일 기반과 동일 형식(prj_ + 10). */
export const makeProjectId = (): string => `prj_${lower()}`;

/** asset 키. 기존 검증식 /^asset_[0-9a-z]+$/ 과 호환. */
export const makeAssetKey = (): string => `asset_${assetNano()}`;

export const isAssetKey = (key: string): boolean => /^asset_[0-9a-z]+$/.test(key);

/** Storage 오브젝트 경로. RLS 정책이 projects/{id} 소유권을 검증한다. */
export const assetObjectPath = (projectId: string, key: string): string =>
  `projects/${projectId}/assets/${key}`;

export const mockupPrefix = (projectId: string): string => `projects/${projectId}/mockup`;

/** 목업 정적 파일 Storage 경로. manifest 엔트리(상대 경로)와 1:1 대응. */
export const mockupObjectPath = (projectId: string, relativePath: string): string =>
  `${mockupPrefix(projectId)}/${relativePath}`;

export const projectPrefix = (projectId: string): string => `projects/${projectId}`;
