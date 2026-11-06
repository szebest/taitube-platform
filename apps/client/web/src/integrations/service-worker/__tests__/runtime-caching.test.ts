import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CACHE_NAMES } from '../cache-names';
import { registerRuntimeCaching } from '../runtime-caching';

vi.mock(import('workbox-routing'), () => ({ registerRoute: vi.fn() }));
vi.mock(import('workbox-strategies'), () => ({
  NetworkFirst: vi.fn(),
  StaleWhileRevalidate: vi.fn(),
}));
vi.mock(import('workbox-expiration'), () => ({ ExpirationPlugin: vi.fn() }));
vi.mock(import('workbox-cacheable-response'), () => ({ CacheableResponsePlugin: vi.fn() }));

const ORIGIN = 'https://taitube.test';

function register() {
  registerRuntimeCaching(ORIGIN, { match: vi.fn() });
  return vi
    .mocked(registerRoute)
    .mock.calls.flatMap(([matcher]) => (typeof matcher === 'function' ? [matcher] : []));
}

function matching(matchers: ReturnType<typeof register>, href: string, destination = '') {
  const url = new URL(href);
  const request = Object.defineProperty(new Request(href), 'destination', { value: destination });
  const event = Object.assign(new Event('fetch'), { waitUntil: vi.fn() });
  return matchers.flatMap((match, index) =>
    match({ url, request, event, sameOrigin: url.origin === ORIGIN }) ? [index] : []
  );
}

describe('apps/client/web: registerRuntimeCaching', () => {
  it.each([
    {
      name: 'a stylesheet of this origin',
      href: `${ORIGIN}/assets/a.css`,
      destination: 'style',
      route: 0,
    },
    {
      name: 'a poster',
      href: 'https://cdn.test/videos/v1/thumbs/poster.jpg',
      destination: 'image',
      route: 1,
    },
    {
      name: 'a storyboard sprite',
      href: 'https://cdn.test/videos/v1/thumbs/sprite.jpg',
      destination: 'image',
      route: 1,
    },
    {
      name: 'a playlist',
      href: 'https://cdn.test/videos/v1/hls/master.m3u8',
      destination: '',
      route: 2,
    },
    { name: 'the public feed', href: `${ORIGIN}/api/v1/feed`, destination: '', route: 3 },
    { name: 'the categories', href: `${ORIGIN}/api/v1/categories`, destination: '', route: 3 },
  ])('routes $name to one strategy', ({ href, destination, route }) => {
    expect(matching(register(), href, destination)).toEqual([route]);
  });

  it.each([
    'https://cdn.test/videos/v1/hls/720p/seg_0001.ts',
    'https://cdn.test/videos/v1/hls/720p/chunk_00001.m4s',
    `${ORIGIN}/api/v1/me/account`,
    `${ORIGIN}/api/v1/feed/subscriptions`,
  ])('leaves %s uncached', (href) => {
    expect(matching(register(), href)).toEqual([]);
  });

  it('names a cache and a timeout for each strategy', () => {
    register();

    expect(
      vi.mocked(StaleWhileRevalidate).mock.calls.map(([options]) => options?.cacheName)
    ).toEqual([CACHE_NAMES.assets, CACHE_NAMES.media]);
    expect(vi.mocked(NetworkFirst).mock.calls.map(([options]) => options)).toMatchObject([
      {
        cacheName: CACHE_NAMES.playlists,
        networkTimeoutSeconds: 3,
        plugins: expect.arrayContaining([
          expect.objectContaining({ cachedResponseWillBeUsed: expect.any(Function) }),
        ]),
      },
      { cacheName: CACHE_NAMES.api },
    ]);
  });
});
