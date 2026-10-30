import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { putAll } from '../put-all';
import { readSavedIndex, savedIndexEntry } from '../saved-index';

const saved = { id: 'v1', title: 'Launch day', savedAt: 5, bytes: 10, urls: ['https://cdn/a'] };

describe('apps/client/web: saved index', () => {
  it('reads back what was written', async () => {
    const cache = await fakeCacheStorage().open('saved');
    await putAll(cache, [savedIndexEntry([saved])]);

    await expect(readSavedIndex(cache)).resolves.toEqual([saved]);
  });

  it.each([
    { name: 'nothing was written', body: undefined },
    { name: 'the record is not JSON', body: 'not json' },
    { name: 'the record has another shape', body: JSON.stringify([{ id: 1 }]) },
  ])('is empty when $name', async ({ body }) => {
    const cache = await fakeCacheStorage().open('saved');
    if (body !== undefined) {
      await cache.put('/_saved/index.json', new Response(body));
    }

    await expect(readSavedIndex(cache)).resolves.toEqual([]);
  });
});
