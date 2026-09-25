import { createApiStore, recordRequests } from '../../../../__tests__/api-store';
import { API_BASE_URL } from '../../../../config';
import { categoriesApi } from '../categories-api';

describe('apps/web: categories api', () => {
  it('lists the categories with GET /v1/categories', async () => {
    const sent = recordRequests();

    await createApiStore().dispatch(categoriesApi.endpoints.categories.initiate());

    expect(sent).toEqual([{ method: 'GET', url: `${API_BASE_URL}/v1/categories`, body: undefined }]);
  });
});
