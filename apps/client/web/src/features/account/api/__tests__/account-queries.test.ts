import { getAccount } from '@vp/api-contracts';
import { account, apiServer } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { mockEndpoint } from '#app/__tests__/mock-endpoint';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { accountQueryOptions } from '../account-queries';

describe('apps/client/web: account queries', () => {
  it("loads the caller's account through the API client", async () => {
    apiServer.use(mockEndpoint(getAccount, () => HttpResponse.json(account())));

    const loaded = await createQueryClient().fetchQuery(accountQueryOptions());

    expect(loaded.channel.handle).toBe('creator');
  });
});
