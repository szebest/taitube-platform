import { getAccount } from '@vp/api-contracts';
import { account, apiServer } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';
import { accountQueryOptions } from '../account-queries';
import { createQueryClient } from '../create-query-client';
import { api, mockEndpoint } from './api';

describe('@vp/queries: account queries', () => {
  it("loads the caller's account through the API client", async () => {
    apiServer.use(mockEndpoint(getAccount, () => HttpResponse.json(account())));

    const loaded = await createQueryClient().fetchQuery(accountQueryOptions(api));

    expect(loaded.channel.handle).toBe('creator');
  });
});
