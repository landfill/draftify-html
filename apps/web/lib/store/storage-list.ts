import { type Db, STORAGE_BUCKET } from "./ids.js";

export interface StorageObject {
  /** 버킷 기준 전체 경로. */
  path: string;
  /** metadata.size (없으면 0). */
  size: number;
}

const PAGE = 1000;

/**
 * prefix 아래 오브젝트를 **재귀로** 모두 나열한다.
 *
 * Supabase Storage의 `list()`는 한 단계만 돌려주고 폴더는 `id: null`로 온다. 목업은 중첩
 * 디렉토리(`js/`, `assets/`)가 흔하므로 재귀·페이지네이션이 필수다 — 한 단계만 보면 총 사용량이
 * 과소 집계되고(W8 쿼터), 삭제·정리에서 오브젝트가 남는다.
 */
export async function listObjectsRecursive(db: Db, prefix: string): Promise<StorageObject[]> {
  const out: StorageObject[] = [];
  const dirs = [prefix.replace(/\/+$/, "")];

  while (dirs.length > 0) {
    const dir = dirs.pop()!;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await db.storage
        .from(STORAGE_BUCKET)
        .list(dir, { limit: PAGE, offset });
      if (error) throw new Error(`storage list failed (${dir}): ${error.message}`);
      const items = data ?? [];
      for (const item of items) {
        const path = `${dir}/${item.name}`;
        if (item.id) {
          out.push({ path, size: (item.metadata?.size as number | undefined) ?? 0 });
        } else {
          dirs.push(path);
        }
      }
      if (items.length < PAGE) break;
    }
  }
  return out;
}

/** prefix 아래 총 바이트. */
export async function sumObjectBytes(db: Db, prefix: string): Promise<number> {
  const objects = await listObjectsRecursive(db, prefix);
  return objects.reduce((sum, o) => sum + o.size, 0);
}

/** prefix 아래 전부 삭제 (재귀). */
export async function removeObjectsUnder(db: Db, prefix: string): Promise<void> {
  const paths = (await listObjectsRecursive(db, prefix)).map((o) => o.path);
  for (let i = 0; i < paths.length; i += PAGE) {
    const chunk = paths.slice(i, i + PAGE);
    const { error } = await db.storage.from(STORAGE_BUCKET).remove(chunk);
    if (error) throw new Error(`storage remove failed: ${error.message}`);
  }
}
