import { createQueryClient } from '@vp/queries';
import { api } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders } from '#app/__tests__/providers';
import { SHORTS } from '#app/__tests__/short-fixtures';
import { shortsFeedQueryOptions } from '#app/lib/query-keys/feed-keys';
import { ShortsShelf } from '../shorts-shelf';

function renderShelf(items: typeof SHORTS) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(shortsFeedQueryOptions(api).queryKey, {
    pages: [{ items, nextCursor: null, total: items.length }],
    pageParams: [undefined],
  });
  return renderPage(<ShortsShelf />, AppProviders, { queryClient });
}

describe('apps/client/web: ShortsShelf', () => {
  it('lists a card for every Short under the Shorts heading', async () => {
    const markup = await renderShelf(SHORTS);

    expect(markup).toContain('>Shorts</h2>');
    expect(markup.match(/href="\/shorts\/0190c3a0/g)).toHaveLength(SHORTS.length);
  });

  it('renders nothing when there are no Shorts', async () => {
    expect(await renderShelf([])).toBe('');
  });
});
