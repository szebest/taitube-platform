import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { fakeCacheStorage } from '#app/__tests__/fake-cache-storage';
import { CACHE_NAMES } from '../cache-names';
import { registerSavedVideoRoutes, savedVideoFallback } from '../saved-videos';

vi.mock(import('workbox-routing'), () => ({ registerRoute: vi.fn() }));
vi.mock(import('workbox-strategies'), () => ({ NetworkOnly: vi.fn() }));

const ORIGIN = 'https://taitube.test';

function failed(href: string) {
  return { request: new Request(href), url: new URL(href) };
}

describe('apps/client/web: registerSavedVideoRoutes', () => {
  it.each([
    { name: 'a video detail call', href: `${ORIGIN}/api/v1/videos/v1`, matched: true },
    { name: 'a segment on the CDN', href: 'https://cdn.test/hls/240p/seg_00001.ts', matched: true },
    {
      name: 'a playlist, which has its own route',
      href: 'https://cdn.test/hls/index.m3u8',
      matched: false,
    },
    { name: 'a comment call', href: `${ORIGIN}/api/v1/videos/v1/comments`, matched: false },
  ])('matches $name: $matched', ({ href, matched }) => {
    registerSavedVideoRoutes(ORIGIN);

    const [matcher] = vi.mocked(registerRoute).mock.calls.at(-1) ?? [];
    const { url, request } = failed(href);
    const event = Object.assign(new Event('fetch'), { waitUntil: vi.fn() });

    expect(
      typeof matcher === 'function' && matcher({ url, request, event, sameOrigin: true })
    ).toBe(matched);
    expect(NetworkOnly).toHaveBeenCalled();
  });
});

describe('apps/client/web: savedVideoFallback', () => {
  it('answers a failed request from the saved cache', async () => {
    const storage = fakeCacheStorage();
    await (await storage.open(CACHE_NAMES.saved)).put(
      `${ORIGIN}/api/v1/videos/v1`,
      new Response('saved')
    );
    const fallback = vi.fn();

    const response = await savedVideoFallback(
      storage,
      fallback
    )(failed(`${ORIGIN}/api/v1/videos/v1`));

    await expect(response.text()).resolves.toBe('saved');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('hands what no saved video holds to the next fallback', async () => {
    const answer = new Response('offline page');
    const fallback = vi.fn().mockResolvedValue(answer);
    const request = failed(`${ORIGIN}/watch/v2`);

    const response = await savedVideoFallback(fakeCacheStorage(), fallback)(request);

    expect(response).toBe(answer);
    expect(fallback).toHaveBeenCalledWith(request);
  });
});
