import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { VIDEO_ID } from '#app/__tests__/fixtures';
import { mockEndpoint, problemReply } from '#app/__tests__/msw/mock-endpoint';
import { serverRender } from '#app/__tests__/server-render';
import { createQueryClient } from '../create-query-client';

describe('apps/client/web: createQueryClient', () => {
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

  it('asks once in a server render when the API fails, so a loader never holds the page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let asked = 0;
    const failing = mockEndpoint(getVideo, () => {
      asked += 1;
      return problemReply(ErrorCodes.INTERNAL);
    });

    await serverRender(`/watch/${VIDEO_ID}`, { handlers: [failing] });

    expect(asked).toBe(1);
  });
});
