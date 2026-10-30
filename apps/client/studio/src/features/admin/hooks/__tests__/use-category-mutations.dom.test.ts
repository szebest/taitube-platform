import type { QueryClient } from '@tanstack/react-query';
import { createCategory, deleteCategory, updateCategory } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint, problemReply } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { adminCategoryKeys } from '#app/features/admin/api/admin-categories';
import { adminCategory } from '#app/features/admin/components/__tests__/categories.fixture';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../use-category-mutations';

const CATEGORY = adminCategory();

function seeded(): QueryClient {
  const client = createQueryClient();
  client.setQueryData(adminCategoryKeys.all, [CATEGORY]);
  return client;
}

const WRITES = [
  {
    write: 'create',
    handler: mockEndpoint(createCategory, () => HttpResponse.json(CATEGORY, { status: 201 })),
    run: (client: QueryClient) =>
      runMutation(
        client,
        useCreateCategory,
        { name: 'Music', slug: 'music', sortOrder: 0, isActive: true },
        AppProviders
      ),
  },
  {
    write: 'update',
    handler: mockEndpoint(updateCategory, () => HttpResponse.json(CATEGORY)),
    run: (client: QueryClient) =>
      runMutation(
        client,
        useUpdateCategory,
        { id: CATEGORY.id, changes: { isActive: false } },
        AppProviders
      ),
  },
  {
    write: 'delete',
    handler: mockEndpoint(deleteCategory, () => new HttpResponse(null, { status: 204 })),
    run: (client: QueryClient) => runMutation(client, useDeleteCategory, CATEGORY.id, AppProviders),
  },
];

describe('apps/client/studio: category mutations', () => {
  it.each(WRITES)('$write marks the studio categories query stale', async ({ handler, run }) => {
    apiServer.use(handler);
    const client = seeded();

    const settled = await run(client);

    expect(settled.status).toBe('fulfilled');
    expect(client.getQueryState(adminCategoryKeys.all)?.isInvalidated).toBe(true);
  });

  it('rejects with the API error when the write is refused', async () => {
    apiServer.use(mockEndpoint(deleteCategory, () => problemReply('CATEGORY_IN_USE')));

    const settled = await runMutation(seeded(), useDeleteCategory, CATEGORY.id, AppProviders);

    expect(settled.status).toBe('rejected');
  });
});
