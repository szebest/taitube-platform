import { environmentManager } from '@tanstack/react-query';
import { ApiError } from '@vp/api-client';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { api, apiServer, mockEndpoint, problemReply, VIDEO_ID } from '@vp/web-testing';
import { createQueryClient } from '../create-query-client';
import { videoQueryOptions } from '../video-queries';

function pinServer(isServer: boolean): void {
  const original = environmentManager.isServer();
  environmentManager.setIsServer(() => isServer);
  onTestFinished(() => environmentManager.setIsServer(() => original));
}

describe('@vp/queries: createQueryClient', () => {
  it('builds a new client for every call, so no two requests share a cache', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });

  it('keeps a hydrated query fresh, so the browser does not refetch what the server loaded', () => {
    const client = createQueryClient();
    client.setQueryData(['video', 'v1'], { title: 'Launch day' });

    const query = client.getQueryCache().find({ queryKey: ['video', 'v1'] });
    const staleTime = client.getDefaultOptions().queries?.staleTime;

    expect(staleTime).toBeGreaterThan(0);
    expect(typeof staleTime === 'number' && query?.isStaleByTime(staleTime)).toBe(false);
  });

  it.each([
    { scenario: 'on the server', server: true, status: 500, retried: false },
    { scenario: 'in the browser, after a server error', server: false, status: 500, retried: true },
    { scenario: 'in the browser, after a refusal', server: false, status: 404, retried: false },
  ])('retries $retried $scenario', ({ server, status, retried }) => {
    pinServer(server);
    const retry = createQueryClient().getDefaultOptions().queries?.retry;
    const error = new ApiError(status, 'ANY', 'failed');

    expect(typeof retry === 'function' ? retry(0, error) : retry).toBe(retried);
  });

  it('asks once on the server when the API fails, so a loader never holds the page', async () => {
    pinServer(true);
    let asked = 0;
    apiServer.use(
      mockEndpoint(getVideo, () => {
        asked += 1;
        return problemReply(ErrorCodes.INTERNAL);
      })
    );

    await expect(
      createQueryClient().fetchQuery(videoQueryOptions(api, VIDEO_ID))
    ).rejects.toThrow();

    expect(asked).toBe(1);
  });
});
