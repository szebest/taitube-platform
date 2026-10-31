import {
  isPageNavigation,
  isPlaylist,
  isPublicApi,
  isSegment,
  isStaticAsset,
  isVideoArt,
  isVideoDetail,
  isVideoSubresource,
} from '../route-matchers';

const ORIGIN = 'https://taitube.test';

describe('apps/client/web: route matchers', () => {
  it.each([
    ['https://cdn.test/public/videos/v1/thumbs/poster.jpg', true],
    ['https://cdn.test/public/videos/v1/thumbs/sprite.jpg', true],
    ['https://cdn.test/videos/v1/thumbs/sprite.vtt?x=1', true],
    ['https://cdn.test/videos/v1/hls/720p/seg_0001.ts', false],
    ['https://cdn.test/videos/v1/thumbs/other.jpg', false],
  ])('video art %s is %s', (href, expected) => {
    expect(isVideoArt(new URL(href))).toBe(expected);
  });

  it.each([
    ['https://cdn.test/videos/v1/hls/master.m3u8', true],
    ['https://cdn.test/videos/v1/hls/720p/index.m3u8?t=1', true],
    ['https://cdn.test/videos/v1/hls/720p/chunk_00001.m4s', false],
    ['https://cdn.test/videos/v1/hls/720p/seg_0001.ts', false],
  ])('playlist %s is %s', (href, expected) => {
    expect(isPlaylist(new URL(href))).toBe(expected);
  });

  it.each([
    [`${ORIGIN}/api/v1/feed`, true],
    [`${ORIGIN}/api/v1/feed?cursor=abc`, true],
    [`${ORIGIN}/api/v1/categories`, true],
    [`${ORIGIN}/api/v1/feed/subscriptions`, false],
    [`${ORIGIN}/api/v1/me/account`, false],
    [`${ORIGIN}/api/v1/videos/v1/reactions`, false],
    ['https://other.test/api/v1/feed', false],
  ])('public api %s is %s', (href, expected) => {
    expect(isPublicApi(new URL(href), ORIGIN)).toBe(expected);
  });

  it.each([
    { href: `${ORIGIN}/x.js`, destination: 'script' as const, expected: true },
    { href: `${ORIGIN}/x.css`, destination: 'style' as const, expected: true },
    { href: `${ORIGIN}/x.woff2`, destination: 'font' as const, expected: true },
    { href: `${ORIGIN}/x.png`, destination: 'image' as const, expected: false },
    { href: 'https://other.test/x.js', destination: 'script' as const, expected: false },
  ])('static asset $href as $destination is $expected', ({ href, destination, expected }) => {
    expect(isStaticAsset(new URL(href), destination, ORIGIN)).toBe(expected);
  });

  it.each([
    { href: `${ORIGIN}/watch/v1`, mode: 'navigate' as const, expected: true },
    { href: `${ORIGIN}/api/v1/feed`, mode: 'navigate' as const, expected: false },
    { href: `${ORIGIN}/watch/v1`, mode: 'cors' as const, expected: false },
  ])('page navigation $href in $mode mode is $expected', ({ href, mode, expected }) => {
    expect(isPageNavigation(new URL(href), mode)).toBe(expected);
  });

  it.each([
    { href: `${ORIGIN}/api/v1/videos/v1/reactions`, resource: 'reactions', expected: true },
    { href: `${ORIGIN}/api/v1/videos/v1/comments`, resource: 'comments', expected: true },
    { href: `${ORIGIN}/api/v1/videos/v1/comments`, resource: 'reactions', expected: false },
    { href: `${ORIGIN}/api/v1/videos/v1/reactions/me`, resource: 'reactions', expected: false },
    { href: `${ORIGIN}/api/v1/comments/c1`, resource: 'comments', expected: false },
    {
      href: 'https://other.test/api/v1/videos/v1/reactions',
      resource: 'reactions',
      expected: false,
    },
  ] as const)('video $resource call $href is $expected', ({ href, resource, expected }) => {
    expect(isVideoSubresource(new URL(href), ORIGIN, resource)).toBe(expected);
  });

  it.each([
    ['https://cdn.test/videos/v1/hls/240p/seg_00001.ts', true],
    ['https://cdn.test/videos/v1/hls/240p/chunk_00001.m4s?x=1', true],
    ['https://cdn.test/videos/v1/hls/240p/index.m3u8', false],
    ['https://cdn.test/videos/v1/thumbs/poster.jpg', false],
  ])('segment %s is %s', (href, expected) => {
    expect(isSegment(new URL(href))).toBe(expected);
  });

  it.each([
    [`${ORIGIN}/api/v1/videos/v1`, true],
    [`${ORIGIN}/api/v1/videos/v1/comments`, false],
    [`${ORIGIN}/api/v1/videos`, false],
    ['https://other.test/api/v1/videos/v1', false],
  ])('video detail %s is %s', (href, expected) => {
    expect(isVideoDetail(new URL(href), ORIGIN)).toBe(expected);
  });
});
