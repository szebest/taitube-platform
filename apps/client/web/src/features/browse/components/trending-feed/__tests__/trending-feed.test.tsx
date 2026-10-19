import type { QueryClient } from '@tanstack/react-query';
import { createQueryClient } from '@vp/queries';
import { api, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { type PublicFeedFilter, publicFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { TrendingFeed } from '../trending-feed';

function withFeed(queryClient: QueryClient, filter: PublicFeedFilter, title: string): void {
  queryClient.setQueryData(
    publicFeedQueryOptions(api, filter).queryKey,
    feedPages([videoSummary({ title })])
  );
}

async function renderTrending() {
  const queryClient = createQueryClient();
  withFeed(queryClient, { sort: 'trending' }, 'Going viral');
  withFeed(queryClient, { sort: 'recent' }, 'Just uploaded');
  return renderPage(<TrendingFeed />, AppProviders, { queryClient });
}

describe('apps/client/web: trending feed', () => {
  it('shows the trending feed under its heading, not the newest one', async () => {
    const markup = await renderTrending();

    expect(markup).toContain('>Trending</h1>');
    expect(markup).toContain('Going viral');
    expect(markup).not.toContain('Just uploaded');
  });
});
