import { listAdminCategories } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { adminCategory } from '#app/features/admin/components/__tests__/categories.fixture';
import { adminCategoriesQueryOptions } from '../admin-categories';

describe('apps/client/studio: adminCategoriesQueryOptions', () => {
  it('fetches the admin list under the one key the mutations invalidate', async () => {
    const category = adminCategory();
    apiServer.use(mockEndpoint(listAdminCategories, () => HttpResponse.json([category])));
    const options = adminCategoriesQueryOptions(api);

    expect(options.queryKey).toEqual(['admin', 'categories']);
    await expect(createQueryClient().fetchQuery(options)).resolves.toEqual([category]);
  });
});
