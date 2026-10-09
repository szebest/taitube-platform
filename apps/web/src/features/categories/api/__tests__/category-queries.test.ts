import { listCategories } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { categoriesQueryOptions } from '../category-queries';

describe('apps/web: category queries', () => {
  it('loads the categories through the API client', async () => {
    apiServer.use(mockEndpoint(listCategories, () => HttpResponse.json([])));

    await expect(createQueryClient().fetchQuery(categoriesQueryOptions())).resolves.toEqual([]);
  });

  it('keeps the categories fresh longer than the app default, as they rarely change', () => {
    const appDefault = createQueryClient().getDefaultOptions().queries?.staleTime;

    expect(categoriesQueryOptions().staleTime).toBeGreaterThan(Number(appDefault));
  });
});
