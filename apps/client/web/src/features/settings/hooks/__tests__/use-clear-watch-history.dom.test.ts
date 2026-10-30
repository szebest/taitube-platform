import { clearWatchHistory } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { apiServer, mockEndpoint } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { AppProviders } from '#app/__tests__/providers';
import { useClearWatchHistory } from '../use-clear-watch-history';

describe('apps/client/web: useClearWatchHistory', () => {
  it('asks the server to clear the whole watch history', async () => {
    let cleared = 0;
    apiServer.use(
      mockEndpoint(clearWatchHistory, () => {
        cleared += 1;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await runMutation(createQueryClient(), useClearWatchHistory, undefined, AppProviders);

    expect(cleared).toBe(1);
  });
});
