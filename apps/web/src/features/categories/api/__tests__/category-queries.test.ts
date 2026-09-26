import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { API_BASE_URL } from '#app/config';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { categoriesQueryOptions } from '../category-queries';

describe('apps/web: category queries', () => {
  it('loads the categories through the API client', async () => {
    const sent = recordRequests(() => jsonResponse([]));

    await createQueryClient().fetchQuery(categoriesQueryOptions());

    expect(sent.map(({ url }) => url)).toEqual([`${API_BASE_URL}/v1/categories`]);
  });

  it('keeps the categories fresh longer than the app default, as they rarely change', () => {
    const appDefault = createQueryClient().getDefaultOptions().queries?.staleTime;

    expect(categoriesQueryOptions().staleTime).toBeGreaterThan(Number(appDefault));
  });
});
