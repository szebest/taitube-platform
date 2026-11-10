import type { HomeShelf } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProvidersWithToasts, signedInWithToasts } from '#app/__tests__/providers';
import { homeQueryOptions } from '#app/lib/query-keys/home-keys';
import { HomePage, HomePageSkeleton } from '../home-page';

const TRENDING: HomeShelf = {
  kind: 'trending',
  items: [{ ...videoSummary({ title: 'Tram ride' }), reason: { kind: 'trending' as const } }],
};

function renderHome(shelves: HomeShelf[], Providers = AppProvidersWithToasts) {
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
    { viewer: 'a guest', Providers: AppProvidersWithToasts, offered: true },
    { viewer: 'a signed-in viewer', Providers: signedInWithToasts(), offered: false },
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

  it('leaves the shelves it is handed to the browser, so the server never caches them', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(homeQueryOptions(api).queryKey, { shelves: [TRENDING] });

    const markup = await renderPage(
      <HomePage clientShelves={{ shorts: <p>Tram flip</p> }} />,
      AppProvidersWithToasts,
      { queryClient }
    );

    expect(markup).not.toContain('Tram flip');
  });

  it('says so when there is nothing to show', async () => {
    expect(await renderHome([])).toContain('Nothing to watch yet');
  });

  it('holds the place of the shelves with no text of its own', async () => {
    const markup = await renderPage(<HomePageSkeleton />, AppProvidersWithToasts);

    expect(markup).not.toMatch(/>[^<]+</);
  });
});
