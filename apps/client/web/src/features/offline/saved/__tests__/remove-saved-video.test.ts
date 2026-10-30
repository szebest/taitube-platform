import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { removeSavedVideo } from '../remove-saved-video';
import { readSavedIndex } from '../saved-index';

const A = 'https://cdn.taitube.test/a';
const B = 'https://cdn.taitube.test/b';
const record = (id: string, urls: string[]) => ({ id, title: id, savedAt: 1, bytes: 1, urls });

async function savedPair() {
  const storage = fakeCacheStorage();
  const cache = await storage.open(CACHE_NAMES.saved);
  await Promise.all([cache.put(A, new Response('a')), cache.put(B, new Response('b'))]);
  await cache.put('/_saved/index.json', Response.json([record('a', [A]), record('b', [B])]));
  return { storage, cache };
}

describe('apps/client/web: removeSavedVideo', () => {
  it('deletes the video entries and its line in the record, and no other', async () => {
    const { storage, cache } = await savedPair();

    const removed = await removeSavedVideo(storage, 'a');

    expect(removed.ok).toBe(true);
    expect(storage.held(CACHE_NAMES.saved)).not.toContain(A);
    expect(storage.held(CACHE_NAMES.saved)).toContain(B);
    expect((await readSavedIndex(cache)).map(({ id }) => id)).toEqual(['b']);
  });

  it('is a success for a video that was never saved', async () => {
    const { storage } = await savedPair();

    await expect(removeSavedVideo(storage, 'missing')).resolves.toEqual({
      ok: true,
      value: undefined,
    });
  });

  it('fails when the cache cannot be opened', async () => {
    const open = vi.fn().mockRejectedValue(new Error('denied'));

    await expect(removeSavedVideo({ open }, 'a')).resolves.toEqual({
      ok: false,
      error: { reason: 'failed' },
    });
  });
});
