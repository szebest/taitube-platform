import { CACHE_NAMES } from '#app/sw/cache-names';
import { readOfflineCache } from '../offline-cache';

function storageHolding(held: Partial<Record<string, string[]>>) {
  return {
    has: async (name: string) => name in held,
    open: async (name: string) => ({ keys: async () => held[name] ?? [] }),
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

    await expect(readOfflineCache(storage)).resolves.toEqual({ feedPages });
  });
});
