import { listCategories } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import {
  page,
  searchReply,
  suggestionsReply,
  videoResult,
} from '#app/features/search/__tests__/search-replies';
import {
  palettePreviewQueryOptions,
  searchQueryOptions,
  searchSuggestionsQueryOptions,
  topicsQueryOptions,
} from '../search-queries';

describe('apps/client/web: search queries', () => {
  it('searches the kind and sort asked for, a page at a time, with the cursor the last page returned', async () => {
    const asked: string[] = [];
    apiServer.use(
      searchReply(
        (params) => page([videoResult()], { nextCursor: params.has('cursor') ? null : 'next' }),
        asked
      )
    );

    await createQueryClient().fetchInfiniteQuery({
      ...searchQueryOptions(api, { query: 'lofi', type: 'channel', sort: 'date' }),
      pages: 2,
    });

    expect(asked).toEqual([
      'q=lofi&type=channel&sort=date&limit=30',
      'q=lofi&type=channel&sort=date&limit=30&cursor=next',
    ]);
  });

  it('keys a search by its words, kind and sort, so each filter is its own cache entry', () => {
    expect(searchQueryOptions(api, { query: 'lofi', type: 'all', sort: 'views' }).queryKey).toEqual(
      ['search', 'results', 'lofi', 'all', 'views']
    );
  });

  it('previews the first five hits of every kind for the palette', async () => {
    const asked: string[] = [];
    apiServer.use(searchReply(() => page([]), asked));

    await createQueryClient().fetchQuery(palettePreviewQueryOptions(api, 'lofi'));

    expect(asked).toEqual(['q=lofi&type=all&limit=5&record=false']);
  });

  it('asks for the suggestions of the words typed', async () => {
    const asked: string[] = [];
    apiServer.use(suggestionsReply([{ type: 'query', text: 'lofi beats' }], asked));

    const { items } = await createQueryClient().fetchQuery(
      searchSuggestionsQueryOptions(api, 'lofi')
    );

    expect(asked).toEqual(['lofi']);
    expect(items).toEqual([{ type: 'query', text: 'lofi beats' }]);
  });

  it('lists the categories as the topics to start from', async () => {
    apiServer.use(mockEndpoint(listCategories, () => HttpResponse.json([])));

    await expect(createQueryClient().fetchQuery(topicsQueryOptions(api))).resolves.toEqual([]);
  });
});
