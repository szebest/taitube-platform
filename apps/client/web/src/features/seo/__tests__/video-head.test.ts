import { video } from '@vp/web-testing';

import { videoHead } from '../video-head';

const SITE = 'https://taitube.test';

describe('apps/client/web: videoHead', () => {
  it('sets the video OpenGraph tags, the Twitter player card and a VideoObject', () => {
    const watched = video({
      title: 'Launch day',
      posterUrl: 'https://cdn.test/p.jpg',
      playbackUrl: 'https://cdn.test/master.m3u8',
      width: 1920,
      height: 1080,
    });
    const url = `${SITE}/watch/${watched.id}`;
    const embed = `${SITE}/embed/${watched.id}`;

    const head = videoHead(watched, SITE);

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { property: 'og:type', content: 'video.other' },
        { property: 'og:image', content: 'https://cdn.test/p.jpg' },
        { property: 'og:video', content: embed },
        { property: 'og:video:url', content: embed },
        { property: 'og:video:secure_url', content: embed },
        { property: 'og:video:type', content: 'text/html' },
        { property: 'og:video:width', content: '1920' },
        { property: 'og:video:height', content: '1080' },
        { name: 'twitter:card', content: 'player' },
        { name: 'twitter:player', content: embed },
        { name: 'twitter:player:width', content: '1920' },
        { name: 'twitter:player:height', content: '1080' },
      ])
    );
    expect(head.links).toEqual([
      { rel: 'canonical', href: url },
      {
        rel: 'alternate',
        type: 'application/json+oembed',
        href: `${SITE}/api/v1/oembed?url=${encodeURIComponent(url)}&format=json`,
        title: 'Launch day',
      },
    ]);
    expect(JSON.parse(head.scripts[0]?.children ?? '')).toMatchObject({ '@type': 'VideoObject' });
  });

  it('names a 16:9 player for a video without a size', () => {
    const { meta } = videoHead(video(), SITE);

    expect(meta).toContainEqual({ property: 'og:video:width', content: '1280' });
    expect(meta).toContainEqual({ name: 'twitter:player:width', content: '1280' });
    expect(meta).toContainEqual({ name: 'twitter:player:height', content: '720' });
  });

  it.each([
    { scenario: 'a private video', overrides: { visibility: 'private' as const } },
    { scenario: 'an unlisted video', overrides: { visibility: 'unlisted' as const } },
    { scenario: 'a video still processing', overrides: { status: 'PROCESSING' as const } },
  ])('sets the title alone for $scenario, whoever opens it', ({ overrides }) => {
    expect(videoHead(video({ title: 'Secret', ...overrides }), SITE)).toEqual({
      meta: [{ title: 'Secret' }],
      links: [],
      scripts: [],
    });
  });
});
