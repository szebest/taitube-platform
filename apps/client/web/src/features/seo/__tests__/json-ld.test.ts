import { videoSummary } from '@vp/web-testing';

import { isoDuration, serializeJsonLd, videoItemList, videoObject } from '../json-ld';

const SITE = 'https://taitube.test';

describe('apps/client/web: json-ld', () => {
  it.each([
    { durationMs: 0, expected: 'PT0S' },
    { durationMs: 45_000, expected: 'PT45S' },
    { durationMs: 60_000, expected: 'PT1M' },
    { durationMs: 3_723_400, expected: 'PT1H2M3S' },
    { durationMs: 7_200_000, expected: 'PT2H' },
  ])('writes $durationMs ms as $expected', ({ durationMs, expected }) => {
    expect(isoDuration(durationMs)).toBe(expected);
  });

  describe('videoObject', () => {
    it('describes a ready video with its thumbnail, upload date, duration, stream and counts', () => {
      const video = videoSummary({
        title: 'Launch day',
        thumbnailUrl: 'https://cdn.test/t.jpg',
        durationMs: 90_000,
        playbackUrl: 'https://cdn.test/master.m3u8',
        viewsCount: 12,
        likesCount: 3,
        readyAt: '2026-01-02T00:00:00.000Z',
      });

      expect(videoObject(video, SITE, { standalone: true })).toEqual({
        '@context': 'https://schema.org',
        '@type': 'VideoObject',
        name: 'Launch day',
        description: 'About something',
        url: `${SITE}/watch/${video.id}`,
        uploadDate: '2026-01-02T00:00:00.000Z',
        thumbnailUrl: ['https://cdn.test/t.jpg'],
        duration: 'PT1M30S',
        contentUrl: 'https://cdn.test/master.m3u8',
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: { '@type': 'WatchAction' },
            userInteractionCount: 12,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: { '@type': 'LikeAction' },
            userInteractionCount: 3,
          },
        ],
        author: {
          '@type': 'Person',
          name: 'The Creator',
          url: `${SITE}/channel/${video.channel?.id}`,
        },
      });
    });

    it('leaves out what the video does not have, and has no context when nested', () => {
      const video = videoSummary({
        title: null,
        description: null,
        viewsCount: undefined,
        channel: null,
      });

      expect(videoObject(video, SITE)).toEqual({
        '@type': 'VideoObject',
        name: 'Untitled',
        description: 'Untitled',
        url: `${SITE}/watch/${video.id}`,
        uploadDate: video.createdAt,
      });
    });
  });

  it('lists each video as a positioned VideoObject', () => {
    const videos = [videoSummary({ title: 'One' }), videoSummary({ title: 'Two' })];

    expect(videoItemList(videos, SITE)).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, item: { '@type': 'VideoObject', name: 'One' } },
        { '@type': 'ListItem', position: 2, item: { '@type': 'VideoObject', name: 'Two' } },
      ],
    });
  });

  it('escapes a closing script tag so a title cannot end the block', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' });

    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});
