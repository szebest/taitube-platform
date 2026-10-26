import type { HomeShelf } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { homeQueryOptions } from '#app/features/home/api/home-queries';
import { HomePage, HomePageSkeleton } from '../home-page';

function renderHome(shelves: HomeShelf[]) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(homeQueryOptions(api).queryKey, { shelves });
  return renderPage(<HomePage />, AppProviders, { queryClient });
}

describe('apps/client/web: home page', () => {
  it('stacks the shelves in the order the API sent them', async () => {
    const item = { ...videoSummary({ title: 'Tram ride' }), reason: { kind: 'trending' as const } };

    const markup = await renderHome([
      { kind: 'continue', items: [item] },
      { kind: 'trending', items: [item] },
    ]);

    expect(markup.indexOf('Continue watching')).toBeGreaterThan(-1);
    expect(markup.indexOf('Trending now')).toBeGreaterThan(markup.indexOf('Continue watching'));
  });

  it('says so when there is nothing to show', async () => {
    expect(await renderHome([])).toContain('Nothing to watch yet');
  });

  it('holds the place of the shelves with no text of its own', async () => {
    const markup = await renderPage(<HomePageSkeleton />, AppProviders);

    expect(markup).not.toMatch(/>[^<]+</);
  });
});
