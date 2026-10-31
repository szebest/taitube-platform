import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';

import { YouPlaylistCard } from '../you-playlist-card';

describe('apps/client/web: YouPlaylistCard', () => {
  it.each([
    { videoCount: 1, meta: '1 video' },
    { videoCount: 24, meta: '24 videos' },
  ])('links the title to the list and counts $videoCount videos', async ({ videoCount, meta }) => {
    const markup = await renderPage(
      <YouPlaylistCard id="p1" title="Road trips" videoCount={videoCount} />,
      AppProviders
    );

    expect(markup).toMatch(/<a[^>]*href="\/playlist\?list=p1"[^>]*>Road trips<\/a>/);
    expect(markup).toContain(meta);
  });
});
