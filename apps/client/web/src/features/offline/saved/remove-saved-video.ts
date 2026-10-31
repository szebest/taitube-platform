import { type Result, err, fromPromise } from '@vp/result';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { putAll } from './put-all';
import { readSavedIndex, savedIndexEntry } from './saved-index';
import type { SaveFailure, SavedStorage } from './saved-video';

/** Deletes a saved video's entries and its line in the record. */
export async function removeSavedVideo(
  storage: SavedStorage['storage'],
  videoId: string
): Promise<Result<void, SaveFailure>> {
  const opened = await fromPromise(
    async () => {
      const cache = await storage.open(CACHE_NAMES.saved);
      const index = await readSavedIndex(cache);
      const target = index.find((saved) => saved.id === videoId);
      await Promise.all((target?.urls ?? []).map((url) => cache.delete(url)));
      return { cache, rest: index.filter((saved) => saved.id !== videoId) };
    },
    (): SaveFailure => ({ reason: 'failed' })
  );
  if (!opened.ok) {
    return err(opened.error);
  }

  return putAll(opened.value.cache, [savedIndexEntry(opened.value.rest)]);
}
