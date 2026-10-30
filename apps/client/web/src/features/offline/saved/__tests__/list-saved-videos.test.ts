import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { listSavedVideos } from '../list-saved-videos';

const record = (id: string, savedAt: number) => ({ id, title: id, savedAt, bytes: 1, urls: [] });

describe('apps/client/web: listSavedVideos', () => {
  it('lists the newest first', async () => {
    const storage = fakeCacheStorage();
    await (await storage.open(CACHE_NAMES.saved)).put(
      '/_saved/index.json',
      Response.json([record('old', 1), record('new', 9)])
    );

    const listed = await listSavedVideos(storage);

    expect(listed.map(({ id }) => id)).toEqual(['new', 'old']);
  });

  it('is empty before anything was saved', async () => {
    await expect(listSavedVideos(fakeCacheStorage())).resolves.toEqual([]);
  });

  it('is empty when the cache cannot be read', async () => {
    const has = vi.fn().mockRejectedValue(new Error('denied'));

    await expect(listSavedVideos({ has, open: vi.fn() })).resolves.toEqual([]);
  });
});
