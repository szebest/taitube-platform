import { buildPath, getVideo } from '@vp/api-contracts';
import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { CACHE_NAMES } from '#app/sw/cache-names';
import { readSavedIndex } from '../saved-index';
import { SAVED_LIMITS } from '../saved-video';
import { saveVideoOffline } from '../save-video-offline';
import { cdnFetch, LOW_URL, MASTER_URL, POSTER_URL, savableVideo } from './saved-fixtures';

const ORIGIN = 'https://taitube.test';
const DETAIL = `${ORIGIN}/api${buildPath(getVideo.path, { id: savableVideo().id })}`;

function save(
  options: { fetch?: typeof fetch; failPut?: Parameters<typeof fakeCacheStorage>[0] } = {}
) {
  const storage = fakeCacheStorage(options.failPut);
  const saved = (video = savableVideo()) =>
    saveVideoOffline({ storage, fetch: options.fetch ?? cdnFetch(), origin: ORIGIN }, video);
  return { storage, saved };
}

describe('apps/client/web: saveVideoOffline', () => {
  it('stores the detail, poster, master, playlist and segments, and records the video', async () => {
    const { storage, saved } = save();

    const result = await saved();

    expect(storage.held(CACHE_NAMES.saved).toSorted()).toEqual(
      [
        DETAIL,
        MASTER_URL,
        LOW_URL,
        POSTER_URL,
        'https://cdn.taitube.test/videos/v1/240p/seg_00000.ts',
        'https://cdn.taitube.test/videos/v1/240p/seg_00001.ts',
        'https://cdn.taitube.test/videos/v1/240p/seg_00002.ts',
        `${ORIGIN}/_saved/index.json`,
      ].toSorted()
    );
    expect(result).toMatchObject({
      ok: true,
      value: { id: savableVideo().id, title: 'Launch day' },
    });
    const cache = await storage.open(CACHE_NAMES.saved);
    await expect(readSavedIndex(cache)).resolves.toHaveLength(1);
  });

  it('serves a master that names only the saved rendition', async () => {
    const { storage, saved } = save();
    await saved();

    const master = await (await storage.open(CACHE_NAMES.saved)).match(MASTER_URL);

    await expect(master?.text()).resolves.toContain(
      `BANDWIDTH=364000,RESOLUTION=426x240\n${LOW_URL}`
    );
  });

  it('keeps no more segments than the budget holds, and closes the playlist after them', async () => {
    const budget = SAVED_LIMITS.bytesPerVideo;
    const { storage, saved } = save({ fetch: cdnFetch({}, Math.floor(budget / 2)) });

    const result = await saved();

    const playlist = await (await storage.open(CACHE_NAMES.saved)).match(LOW_URL);
    expect((await playlist?.text())?.match(/\.ts/g)).toHaveLength(1);
    expect(result.ok && result.value.bytes).toBeLessThanOrEqual(budget);
  });

  it.each([
    {
      name: 'a video with no finished rendition',
      video: savableVideo({ renditions: [] }),
      fetch: cdnFetch(),
    },
    {
      name: 'a video with no playback URL',
      video: savableVideo({ playbackUrl: undefined }),
      fetch: cdnFetch(),
    },
    {
      name: 'a rendition playlist the CDN refuses',
      video: savableVideo(),
      fetch: cdnFetch({ [LOW_URL]: new Response(null, { status: 404 }) }),
    },
    {
      name: 'segments that cannot be fetched',
      video: savableVideo(),
      fetch: cdnFetch({ [LOW_URL]: new Response('#EXTM3U\nseg_missing.m3u8x\n') }),
    },
  ])('cannot save $name', async ({ video, fetch }) => {
    const { storage, saved } = save({ fetch });

    await expect(saved(video)).resolves.toEqual({ ok: false, error: { reason: 'unavailable' } });
    expect(storage.held(CACHE_NAMES.saved)).toEqual([]);
  });

  it('saves a video without its poster when the poster is missing', async () => {
    const { storage, saved } = save({
      fetch: cdnFetch({ [POSTER_URL]: new Response(null, { status: 404 }) }),
    });

    const result = await saved();

    expect(result.ok).toBe(true);
    expect(storage.held(CACHE_NAMES.saved)).not.toContain(POSTER_URL);
  });

  it('refuses a video past the cap, but still re-saves one already kept', async () => {
    const { storage, saved } = save();
    const cache = await storage.open(CACHE_NAMES.saved);
    const kept = Array.from({ length: SAVED_LIMITS.videos }, (_, id) => ({
      id: `other-${id}`,
      title: '',
      savedAt: id,
      bytes: 1,
      urls: [],
    }));
    await cache.put('/_saved/index.json', Response.json(kept));

    await expect(saved()).resolves.toEqual({
      ok: false,
      error: { reason: 'limit', limit: SAVED_LIMITS.videos },
    });

    await cache.put(
      '/_saved/index.json',
      Response.json([...kept.slice(1), { ...kept[0], id: savableVideo().id }])
    );

    expect((await saved()).ok).toBe(true);
  });

  it('stores nothing and reports a full disk when a write hits the quota', async () => {
    const { storage, saved } = save({
      failPut: {
        failPut: (url) =>
          url === POSTER_URL ? new DOMException('full', 'QuotaExceededError') : undefined,
      },
    });

    await expect(saved()).resolves.toEqual({ ok: false, error: { reason: 'quota' } });
    expect(storage.held(CACHE_NAMES.saved)).toEqual([]);
  });
});
