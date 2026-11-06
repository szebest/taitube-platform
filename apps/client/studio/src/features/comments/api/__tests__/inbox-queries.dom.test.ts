import { listCreatorComments } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, inboxComment, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { inboxQueryOptions } from '../inbox-queries';

describe('apps/client/studio: inboxQueryOptions', () => {
  it('fetches one filter a page at a time under the key a new comment invalidates', async () => {
    const asked: (string | null)[] = [];
    apiServer.use(
      mockEndpoint(listCreatorComments, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('filter'));
        return HttpResponse.json({ items: [inboxComment()], nextCursor: null });
      })
    );
    const options = inboxQueryOptions(api, 'reported');

    const data = await createQueryClient().fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(['creator', 'comments', 'reported']);
    expect(asked).toEqual(['reported']);
    expect(data.pages[0]?.items).toEqual([inboxComment()]);
  });
});
