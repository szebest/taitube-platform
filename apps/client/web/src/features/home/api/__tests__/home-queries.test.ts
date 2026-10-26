import { getHome } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, apiServer, mockEndpoint } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { homeQueryOptions } from '../home-queries';

describe('apps/client/web: home queries', () => {
  it('reads the home shelves', async () => {
    apiServer.use(mockEndpoint(getHome, () => HttpResponse.json({ shelves: [] })));

    await expect(createQueryClient().fetchQuery(homeQueryOptions(api))).resolves.toEqual({
      shelves: [],
    });
  });
});
