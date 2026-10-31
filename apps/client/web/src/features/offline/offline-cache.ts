import { CACHE_NAMES } from '#app/sw/cache-names';
import { listSavedVideos } from './saved/list-saved-videos';
import type { SavedVideo } from './saved/saved-video';

export type OfflineCache = {
  /** Feed and category listings the worker holds, which load with no network. */
  feedPages: number;
  /** The videos the viewer saved for offline, newest first. */
  savedVideos: SavedVideo[];
};

export const NOTHING_CACHED: OfflineCache = { feedPages: 0, savedVideos: [] };

type CacheCatalogue = {
  has(name: string): Promise<boolean>;
  open(name: string): Promise<Pick<Cache, 'match'> & { keys(): Promise<readonly unknown[]> }>;
};

async function countEntries(storage: CacheCatalogue, name: string) {
  if (!(await storage.has(name))) {
    return 0;
  }
  const cache = await storage.open(name);
  return (await cache.keys()).length;
}

/** What the worker's caches and the saved cache hold for the offline page to list. */
export async function readOfflineCache(storage: CacheCatalogue): Promise<OfflineCache> {
  return {
    feedPages: await countEntries(storage, CACHE_NAMES.api),
    savedVideos: await listSavedVideos(storage),
  };
}
