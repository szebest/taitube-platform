import type { ReasonedVideo, VideoSummary } from '@vp/api-contracts';
import { CHANNEL_ID, VIDEO_ID, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { VideoCard, VideoCardSkeleton } from '../video-card';

const renderCard = (overrides: Partial<VideoSummary> = {}, reason?: ReasonedVideo['reason']) =>
  renderPage(<VideoCard video={videoSummary(overrides)} reason={reason} />, AppProviders);

describe('apps/client/web: video card', () => {
  it('shows the thumbnail, the duration, the title, the channel, the views and the age', async () => {
    const markup = await renderCard({
      title: 'Launch day',
      thumbnailUrl: 'http://localhost:9000/thumbs/t.jpg',
      posterUrl: 'http://localhost:9000/posters/p.jpg',
      durationMs: 765_000,
      viewsCount: 1_200_000,
    });

    expect(markup).toContain('src="http://localhost:9000/thumbs/t.jpg"');
    expect(markup).toContain('>12:45</span>');
    expect(markup).toMatch(new RegExp(`<a[^>]*href="/watch/${VIDEO_ID}"[^>]*>Launch day</a>`));
    expect(markup).toContain(`href="/channel/${CHANNEL_ID}"`);
    expect(markup).toContain('>The Creator</a>');
    expect(markup).toContain('1.2M views');
    expect(markup).toMatch(/<time dateTime="2026-01-01T00:00:00.000Z">[^<]+ ago<\/time>/);
  });

  it.each([
    {
      scenario: 'an untitled video of an owner without a channel',
      overrides: { title: null, channel: null },
      shown: ['Untitled video'],
      absent: ['/channel/', '<img'],
    },
    {
      scenario: 'a video with only a poster and no duration yet',
      overrides: { posterUrl: 'http://localhost:9000/posters/p.jpg' },
      shown: ['src="http://localhost:9000/posters/p.jpg"'],
      absent: ['tabular-nums'],
    },
    {
      scenario: 'a video the viewer is half way through, picked for being similar',
      overrides: {
        durationMs: 200_000,
        viewer: { progressSeconds: 100, watchedAt: '2026-01-02T00:00:00.000Z' },
      },
      reason: { kind: 'shared-tags' as const },
      shown: ['role="progressbar"', 'aria-valuenow="50"', '50% watched', 'Similar topics'],
      absent: [],
    },
    {
      scenario: 'a video the viewer has not watched',
      overrides: { durationMs: 200_000, viewer: null },
      shown: [],
      absent: ['role="progressbar"', 'Similar topics'],
    },
  ])('renders $scenario', async ({ overrides, reason, shown, absent }) => {
    const markup = await renderCard(overrides, reason);

    for (const text of shown) expect(markup).toContain(text);
    for (const text of absent) expect(markup).not.toContain(text);
  });

  it('holds the place of a card with no text of its own', async () => {
    const markup = await renderPage(<VideoCardSkeleton />, AppProviders);

    expect(markup).toContain('aspect-video');
    expect(markup).not.toMatch(/>[^<]+</);
  });
});
