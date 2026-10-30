import { resolveCommentReport } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { adminReportKeys } from '#app/features/admin/api/admin-reports';
import { commentReport } from '#app/features/admin/components/__tests__/moderation.fixture';
import { useResolveReport } from '../use-report-resolution';

const REPORT = commentReport();

const seeded = () => {
  const client = createQueryClient();
  client.setQueryData(adminReportKeys.all, { pages: [], pageParams: [] });
  return client;
};

describe('apps/client/studio: useResolveReport', () => {
  it.each(['removed', 'dismissed'] as const)('sends %s and marks the queue stale', async (resolution) => {
    const bodies: unknown[] = [];
    apiServer.use(
      mockEndpoint(resolveCommentReport, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json(REPORT);
      })
    );
    const client = seeded();

    const settled = await runMutation(client, useResolveReport, { id: REPORT.id, resolution }, AppProviders);

    expect(settled.status).toBe('fulfilled');
    expect(bodies).toEqual([{ resolution }]);
    expect(client.getQueryState(adminReportKeys.all)?.isInvalidated).toBe(true);
  });

  it('rejects when the report is already resolved', async () => {
    apiServer.use(mockEndpoint(resolveCommentReport, () => problemReply('REPORT_ALREADY_RESOLVED')));

    const settled = await runMutation(
      seeded(),
      useResolveReport,
      { id: REPORT.id, resolution: 'removed' },
      AppProviders
    );

    expect(settled.status).toBe('rejected');
  });
});
