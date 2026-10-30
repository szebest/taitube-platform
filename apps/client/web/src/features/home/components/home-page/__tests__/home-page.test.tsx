import type { HomeShelf } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { homeQueryOptions } from '#app/features/home/api/home-queries';
import { HomePage, HomePageSkeleton } from '../home-page';

const TRENDING: HomeShelf = {
  kind: 'trending',
  items: [{ ...videoSummary({ title: 'Tram ride' }), reason: { kind: 'trending' as const } }],
};

function renderHome(shelves: HomeShelf[], Providers = AppProviders) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(homeQueryOptions(api).queryKey, { shelves });
  return renderPage(<HomePage />, Providers, { queryClient });
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

  it.each([
    { viewer: 'a guest', Providers: AppProviders, offered: true },
    { viewer: 'a signed-in viewer', Providers: signedIn(), offered: false },
  ])(
    'offers $viewer the sign-in line of the subscriptions section: $offered',
    async ({ Providers, offered }) => {
      const markup = await renderHome([TRENDING], Providers);

      expect(markup.includes('Sign in to see what the channels you follow have posted')).toBe(
        offered
      );
      expect(markup.includes('href="/login?redirect=')).toBe(offered);
    }
  );

  it('leaves the Shorts shelf to the browser, so the server never caches an empty Shorts feed', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(homeQueryOptions(api).queryKey, { shelves: [TRENDING] });
    queryClient.setQueryData(shortsFeedQueryOptions(api).queryKey, {
      pages: [
        {
          items: [videoSummary({ title: 'Tram flip', format: 'short' })],
          nextCursor: null,
          total: 1,
        },
      ],
      pageParams: [undefined],
    });

    const markup = await renderPage(<HomePage />, AppProviders, { queryClient });

    expect(markup).not.toContain('Tram flip');
  });

  it('says so when there is nothing to show', async () => {
    expect(await renderHome([])).toContain('Nothing to watch yet');
  });

  it('holds the place of the shelves with no text of its own', async () => {
    const markup = await renderPage(<HomePageSkeleton />, AppProviders);

    expect(markup).not.toMatch(/>[^<]+</);
  });
});
