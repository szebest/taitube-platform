import { listCategories } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { mockEndpoint } from '#app/__tests__/api';
import { categoriesQueryOptions } from '../category-queries';

describe('apps/client/web: category queries', () => {
  it('loads the categories through the API client', async () => {
    apiServer.use(mockEndpoint(listCategories, () => HttpResponse.json([])));

    await expect(createQueryClient().fetchQuery(categoriesQueryOptions())).resolves.toEqual([]);
  });

  it('keeps the categories fresh longer than the app default, as they rarely change', () => {
    const appDefault = createQueryClient().getDefaultOptions().queries?.staleTime;

    expect(categoriesQueryOptions().staleTime).toBeGreaterThan(Number(appDefault));
  });
});
