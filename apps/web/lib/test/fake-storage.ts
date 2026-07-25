import type { Db } from "../store/ids.js";

/**
 * Supabase Storage의 최소 스텁 — `list`(단계별·페이지네이션)·`download`·`remove`만.
 * 실 Storage 없이 재귀 나열·크기 집계·정리 로직을 검증하기 위한 것이고, 실제 왕복은
 * `lib/store/supabase.integration.test.ts`가 본다.
 */

export interface FakeObject {
  size: number;
  /** 지정하면 download 가능. 없으면 download 시 에러 — "이 파일은 받지 않는다"를 검증할 수 있다. */
  body?: string;
}

export interface FakeStorage {
  db: Db;
  removed: string[];
  downloaded: string[];
}

export function createFakeStorage(objects: Record<string, FakeObject>): FakeStorage {
  const removed: string[] = [];
  const downloaded: string[] = [];
  const store = new Map(Object.entries(objects));

  const api = {
    storage: {
      from: () => ({
        async list(dir: string, opts?: { limit?: number; offset?: number }) {
          const prefix = `${dir}/`;
          const files = new Map<string, number>();
          const dirs = new Set<string>();
          for (const [path, obj] of store) {
            if (!path.startsWith(prefix)) continue;
            const rest = path.slice(prefix.length);
            const slash = rest.indexOf("/");
            if (slash === -1) files.set(rest, obj.size);
            else dirs.add(rest.slice(0, slash));
          }
          const items = [
            ...[...dirs].map((name) => ({ name, id: null, metadata: null })),
            ...[...files].map(([name, size]) => ({
              name,
              id: `obj_${name}`,
              metadata: { size },
            })),
          ].sort((a, b) => a.name.localeCompare(b.name));

          const offset = opts?.offset ?? 0;
          const limit = opts?.limit ?? items.length;
          return { data: items.slice(offset, offset + limit), error: null };
        },

        async download(path: string) {
          downloaded.push(path);
          const obj = store.get(path);
          if (!obj || obj.body === undefined) {
            return { data: null, error: { message: `not found: ${path}` } };
          }
          return { data: new Blob([obj.body]), error: null };
        },

        async remove(paths: string[]) {
          for (const p of paths) {
            removed.push(p);
            store.delete(p);
          }
          return { data: null, error: null };
        },
      }),
    },
  };

  return { db: api as unknown as Db, removed, downloaded };
}
