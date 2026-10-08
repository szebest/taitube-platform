import { getAccount } from '@vp/api-contracts';
import { HttpResponse } from 'msw/http';
import { account } from '#app/__tests__/fixtures';
import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint } from '#app/__tests__/msw/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { accountQueryOptions } from '../account-queries';

describe('apps/web: account queries', () => {
  it("loads the caller's account through the API client", async () => {
    apiServer.use(mockEndpoint(getAccount, () => HttpResponse.json(account())));

    const loaded = await createQueryClient().fetchQuery(accountQueryOptions());

    expect(loaded.channel.handle).toBe('creator');
  });
});
