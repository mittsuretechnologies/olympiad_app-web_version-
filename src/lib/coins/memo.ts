// Tiny in-memory cache for admin-edited data that every app request needs
// (settings, streak ladder, task list, game rules). Dashboard writes call
// invalidate() so this instance sees a change at once; other instances pick it
// up within TTL_MS. Concurrent misses share one query.

const TTL_MS = 30_000;

interface Entry { value?: unknown; expiresAt: number; inflight?: Promise<unknown>; gen: number }
const entries = new Map<string, Entry>();
let generation = 0;

export async function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit && hit.value !== undefined && hit.expiresAt > now) return hit.value as T;
  if (hit?.inflight) return hit.inflight as Promise<T>;

  const gen = generation;
  const inflight = load()
    .then((value) => {
      // An invalidate() during the query means this answer may already be stale.
      if (gen === generation) entries.set(key, { value, expiresAt: Date.now() + TTL_MS, gen });
      else entries.delete(key);
      return value;
    })
    .catch((e) => {
      entries.delete(key);
      throw e;
    });
  entries.set(key, { expiresAt: 0, inflight, gen });
  return inflight;
}

export function invalidateCoinCache() {
  generation += 1;
  entries.clear();
}
