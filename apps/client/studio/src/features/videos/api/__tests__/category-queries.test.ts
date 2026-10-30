import { QueryClient } from '@tanstack/react-query';
import { listCategories } from '@vp/api-contracts';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { categoriesQueryOptions, categoryKeys } from '../category-queries';

describe('apps/client/studio: categoriesQueryOptions', () => {
  it('lists the public categories under the categories key', async () => {
    apiServer.use(mockEndpoint(listCategories, () => HttpResponse.json([])));
    const client = new QueryClient();

    await expect(client.fetchQuery(categoriesQueryOptions(api))).resolves.toEqual([]);
    expect(client.getQueryData(categoryKeys.all)).toEqual([]);
  });
});
