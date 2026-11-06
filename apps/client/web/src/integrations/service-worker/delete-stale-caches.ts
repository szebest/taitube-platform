import { isStaleCache } from './cache-names';

/** Removes the caches an earlier version of this worker named, once the new one is active. */
export async function deleteStaleCaches(
  storage: Pick<CacheStorage, 'keys' | 'delete'>
): Promise<void> {
  const names = await storage.keys();
  await Promise.all(names.filter(isStaleCache).map((name) => storage.delete(name)));
}
