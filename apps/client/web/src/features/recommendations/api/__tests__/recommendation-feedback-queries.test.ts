import { listRecommendationFeedback } from '@vp/api-contracts';
import { createQueryClient, KEYSET_PAGE_SIZE } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { hiddenRecommendationsQueryOptions } from '../recommendation-feedback-queries';

describe('apps/client/web: recommendation feedback queries', () => {
  it('reads the first page of what the viewer hid, then the next from its cursor', async () => {
    const asked: Array<string | null> = [];
    apiServer.use(
      mockEndpoint(listRecommendationFeedback, ({ request }) => {
        const url = new URL(request.url);
        asked.push(url.searchParams.get('cursor'));
        expect(url.searchParams.get('limit')).toBe(String(KEYSET_PAGE_SIZE));
        return HttpResponse.json({ items: [], nextCursor: asked.length === 1 ? 'next' : null });
      })
    );
    const client = createQueryClient();
    const options = hiddenRecommendationsQueryOptions(api);

    await client.fetchInfiniteQuery({ ...options, pages: 2 });

    expect(asked).toEqual([null, 'next']);
  });
});
