// Process-local cache: no signed URLs, image bytes or customer data are retained.
type Entry = { expiresAt: number; promise: Promise<boolean> };
const entries = new Map<string, Entry>();
export async function cachedCatalogueProbe(realm: string, path: string, probe: () => Promise<boolean>, now = Date.now()) {
  const key = JSON.stringify([realm, path]);
  const existing = entries.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const entry: Entry = { expiresAt: now + 30_000, promise: Promise.resolve(false) };
  entry.promise = Promise.resolve().then(probe).catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
  entries.set(key, entry);
  if (entries.size > 512) entries.delete(entries.keys().next().value!);
  return entry.promise;
}
export function invalidateCatalogueAvailability(path?: string) {
  for (const key of entries.keys()) if (!path || (JSON.parse(key) as string[])[1] === path) entries.delete(key);
}
