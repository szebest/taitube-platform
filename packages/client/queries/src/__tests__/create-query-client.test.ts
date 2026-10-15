import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID, apiServer, problemReply } from '@vp/web-testing';
import { createQueryClient } from '../create-query-client';
import { videoQueryOptions } from '../video-queries';
import { api, mockEndpoint } from './api';

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

  it('asks once on the server when the API fails, so a loader never holds the page', async () => {
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
