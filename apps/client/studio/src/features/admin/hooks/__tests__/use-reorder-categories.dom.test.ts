import type { QueryClient } from '@tanstack/react-query';
import { updateCategory } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { adminCategoryKeys } from '#app/features/admin/api/admin-categories';
import { adminCategory } from '#app/features/admin/components/__tests__/categories.fixture';
import { useReorderCategories } from '../use-reorder-categories';

const FIRST = adminCategory({ sortOrder: 0 });
const SECOND = adminCategory({ sortOrder: 1 });
const THIRD = adminCategory({ sortOrder: 2 });

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(adminCategoryKeys.all, [FIRST, SECOND, THIRD]);
  return client;
}

describe('apps/client/studio: useReorderCategories', () => {
  it('patches only the categories whose place changed, to their new place', async () => {
    const patches: { id: string; body: unknown }[] = [];
    apiServer.use(
      mockEndpoint(updateCategory, async ({ request, params }) => {
        patches.push({ id: String(params['id']), body: await request.json() });
        return HttpResponse.json(FIRST);
      })
    );

    await runMutation(seeded(), useReorderCategories, [FIRST, THIRD, SECOND], AppProviders);

    expect(patches).toEqual(
      expect.arrayContaining([
        { id: THIRD.id, body: { sortOrder: 1 } },
        { id: SECOND.id, body: { sortOrder: 2 } },
      ])
    );
    expect(patches).toHaveLength(2);
  });

  it('puts the previous order back when a save is refused', async () => {
    apiServer.use(mockEndpoint(updateCategory, () => problemReply(ErrorCodes.INTERNAL)));
    const client = seeded();

    const settled = await runMutation(
      client,
      useReorderCategories,
      [SECOND, FIRST, THIRD],
      AppProviders
    );

    expect(settled.status).toBe('rejected');
    expect(client.getQueryData(adminCategoryKeys.all)).toEqual([FIRST, SECOND, THIRD]);
  });
});
