import { listAdminVideos } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { adminVideo } from '#app/features/admin/components/__tests__/moderation.fixture';
import { adminVideosQueryOptions } from '../admin-videos';

describe('apps/client/studio: adminVideosQueryOptions', () => {
  it('sends the filters with the page size, keyed by them under the key the overrides invalidate', async () => {
    const queries: URLSearchParams[] = [];
    const first = adminVideo();
    apiServer.use(
      mockEndpoint(listAdminVideos, ({ request }) => {
        queries.push(new URL(request.url).searchParams);
        return HttpResponse.json({ items: [first], nextCursor: 'next' });
      })
    );
    const options = adminVideosQueryOptions(api, { status: 'READY', sort: 'views' });

    const data = await createQueryClient().fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(['admin', 'videos', { status: 'READY', sort: 'views' }]);
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      status: 'READY',
      sort: 'views',
      limit: '30',
    });
    expect(data.pages[0]?.items).toEqual([first]);
    expect(data.pages[0]?.nextCursor).toBe('next');
  });
});
