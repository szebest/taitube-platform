import { fromPromise } from '@vp/result';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { readSavedIndex } from './saved-index';
import type { SavedVideo } from './saved-video';

type SavedCatalogue = {
  has(name: string): Promise<boolean>;
  open(name: string): Promise<Pick<Cache, 'match'>>;
};

/** The saved videos, newest first; empty where nothing is saved or the cache cannot be read. */
export async function listSavedVideos(storage: SavedCatalogue): Promise<SavedVideo[]> {
  const read = await fromPromise(
    async () =>
      (await storage.has(CACHE_NAMES.saved))
        ? await readSavedIndex(await storage.open(CACHE_NAMES.saved))
        : [],
    (cause) => cause
  );
  return read.ok ? read.value.toSorted((a, b) => b.savedAt - a.savedAt) : [];
}
