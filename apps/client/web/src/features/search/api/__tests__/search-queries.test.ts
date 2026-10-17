import { search } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint, videoSummary } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { videoSearchQueryOptions } from '../search-queries';

const page = (nextCursor: string | null) => ({
  items: [{ type: 'video' as const, data: videoSummary() }],
  nextCursor,
  tookMs: 3,
  total: 2,
  fuzzyFallback: false,
});

describe('apps/client/web: search queries', () => {
  it('searches videos only, a page at a time, with the cursor the last page returned', async () => {
    const searches: string[] = [];
    apiServer.use(
      mockEndpoint(search, ({ request }) => {
        const { searchParams } = new URL(request.url);
        searches.push(searchParams.toString());
        return HttpResponse.json(page(searchParams.has('cursor') ? null : 'next'));
      })
    );

    await createQueryClient().fetchInfiniteQuery({
      ...videoSearchQueryOptions(api, 'lofi'),
      pages: 2,
    });

    expect(searches).toEqual([
      'q=lofi&type=video&limit=30',
      'q=lofi&type=video&limit=30&cursor=next',
    ]);
  });
});
