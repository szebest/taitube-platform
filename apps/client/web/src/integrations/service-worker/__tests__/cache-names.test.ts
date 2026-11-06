import { CACHE_NAMES, isStaleCache } from '../cache-names';

describe('apps/client/web: cache names', () => {
  it.each(Object.values(CACHE_NAMES))('keeps the current cache %s', (name) => {
    expect(isStaleCache(name)).toBe(false);
  });

  it.each(['taitube-api-v0', 'taitube-media-v0', 'taitube-old-v1'])(
    'drops the earlier version %s',
    (name) => {
      expect(isStaleCache(name)).toBe(true);
    }
  );

  it.each(['workbox-precache-v2-https://x/', 'other-cache', 'taitube'])(
    'leaves %s to its owner',
    (name) => {
      expect(isStaleCache(name)).toBe(false);
    }
  );
});
