import { CACHE_NAMES } from '../cache-names';
import { deleteStaleCaches } from '../delete-stale-caches';

describe('apps/client/web: deleteStaleCaches', () => {
  it('deletes only the caches an earlier version named', async () => {
    const names = [CACHE_NAMES.api, 'taitube-api-v0', 'taitube-media-v0', 'workbox-precache-v2-x'];
    const storage = {
      keys: vi.fn().mockResolvedValue(names),
      delete: vi.fn().mockResolvedValue(true),
    };

    await deleteStaleCaches(storage);

    expect(storage.delete.mock.calls).toEqual([['taitube-api-v0'], ['taitube-media-v0']]);
  });
});
