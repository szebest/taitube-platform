import { listCommentReports } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { commentReport } from '#app/features/admin/components/__tests__/moderation.fixture';
import { adminReportsQueryOptions } from '../admin-reports';

describe('apps/client/studio: adminReportsQueryOptions', () => {
  it('fetches the queue a page at a time under the one key resolving invalidates', async () => {
    const report = commentReport();
    apiServer.use(
      mockEndpoint(listCommentReports, () => HttpResponse.json({ items: [report], nextCursor: null }))
    );
    const options = adminReportsQueryOptions(api);

    const data = await createQueryClient().fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(['admin', 'reports']);
    expect(data.pages[0]?.items).toEqual([report]);
  });
});
