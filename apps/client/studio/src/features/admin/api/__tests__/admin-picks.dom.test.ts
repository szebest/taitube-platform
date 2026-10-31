import { listAdminPicks } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { adminPick } from '#app/features/admin/components/__tests__/picks.fixture';
import { adminPicksQueryOptions } from '../admin-picks';

describe('apps/client/studio: adminPicksQueryOptions', () => {
  it('fetches the picks of the next 30 days under the one key the mutations invalidate', async () => {
    const pick = adminPick();
    apiServer.use(mockEndpoint(listAdminPicks, () => HttpResponse.json({ items: [pick] })));
    const options = adminPicksQueryOptions(api);

    expect(options.queryKey).toEqual(['admin', 'picks']);
    await expect(createQueryClient().fetchQuery(options)).resolves.toEqual([pick]);
  });
});
