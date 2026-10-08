import { getAccount } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';

import { apiServer } from '#app/__tests__/msw/api-server';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { accountQueryOptions } from '#app/features/account/api/account-queries';
import { createQueryClient } from '../create-query-client';

describe('apps/web: createQueryClient in the browser', () => {
  it('asks once for a query the API refuses with a 401, without retrying', async () => {
    let asked = 0;
    apiServer.use(
      mockEndpoint(getAccount, () => {
        asked += 1;
        return problemReply(ErrorCodes.UNAUTHORIZED);
      })
    );

    const [settled] = await Promise.allSettled([
      createQueryClient().fetchQuery(accountQueryOptions()),
    ]);

    expect(settled?.status).toBe('rejected');
    expect(asked).toBe(1);
  });
});
