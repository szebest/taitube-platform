import { jsonResponse, recordRequests } from '#app/__tests__/api-store';
import { account } from '#app/__tests__/fixtures';
import { API_BASE_URL } from '#app/config';
import { createQueryClient } from '#app/integrations/query/create-query-client';
import { accountQueryOptions } from '../account-queries';

describe('apps/web: account queries', () => {
  it("loads the caller's account through the API client", async () => {
    const sent = recordRequests(() => jsonResponse(account()));

    const loaded = await createQueryClient().fetchQuery(accountQueryOptions());

    expect(loaded.channel.handle).toBe('creator');
    expect(sent.map(({ url }) => url)).toEqual([`${API_BASE_URL}/v1/me/account`]);
  });
});
