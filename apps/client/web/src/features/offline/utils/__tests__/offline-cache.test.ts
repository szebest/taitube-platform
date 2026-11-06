import { CACHE_NAMES } from '#app/sw/cache-names';
import { readOfflineCache } from '../offline-cache';

function storageHolding(held: Partial<Record<string, string[]>>, saved: object[] = []) {
  return {
    has: async (name: string) => name in held,
    open: async (name: string) => ({
      keys: async () => held[name] ?? [],
      match: async () => (name === CACHE_NAMES.saved ? Response.json(saved) : undefined),
    }),
  };
}

describe('apps/client/web: readOfflineCache', () => {
  it.each([
    {
      name: 'counts the listings the worker holds',
      held: { [CACHE_NAMES.api]: ['a', 'b'] },
      feedPages: 2,
    },
    { name: 'counts nothing before the worker cached anything', held: {}, feedPages: 0 },
    { name: 'ignores caches of other kinds', held: { [CACHE_NAMES.media]: ['a'] }, feedPages: 0 },
  ])('$name', async ({ held, feedPages }) => {
    const storage = storageHolding(held);

    await expect(readOfflineCache(storage)).resolves.toEqual({ feedPages, savedVideos: [] });
  });

  it('lists the saved videos, newest first', async () => {
    const record = (id: string, savedAt: number) => ({
      id,
      title: id,
      savedAt,
      bytes: 1,
      urls: [],
    });
    const storage = storageHolding({ [CACHE_NAMES.saved]: ['x'] }, [
      record('old', 1),
      record('new', 2),
    ]);

    const { savedVideos } = await readOfflineCache(storage);

    expect(savedVideos.map(({ id }) => id)).toEqual(['new', 'old']);
  });
});
