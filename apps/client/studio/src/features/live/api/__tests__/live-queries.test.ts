import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { api, apiServer } from '@vp/web-testing';
import {
  liveApi,
  liveNow,
  liveStream,
  OVERLAY_TOKEN,
  overlayApi,
} from '#app/features/live/__tests__/live-api.fixture';
import {
  LIVE_POLL_MS,
  liveKeys,
  liveOverlayQueryOptions,
  myLiveStreamQueryOptions,
} from '../live-queries';

describe('apps/client/studio: live queries', () => {
  it('keys every query under one prefix, so one invalidation reaches them all', () => {
    expect([liveKeys.mine(), liveKeys.overlay('t')].map(([prefix]) => prefix)).toEqual([
      liveKeys.all[0],
      liveKeys.all[0],
    ]);
  });

  it("fetches the channel's stream by opening it", async () => {
    apiServer.use(...liveApi(liveStream({ title: 'Opened' })).handlers);

    const stream = await new QueryClient().fetchQuery(myLiveStreamQueryOptions(api));

    expect(stream.title).toBe('Opened');
  });

  it.each([
    { status: 'IDLE', interval: LIVE_POLL_MS },
    { status: 'LIVE', interval: false },
    { status: 'ENDED', interval: false },
  ] as const)('polls the stream at $interval while it is $status', ({ status, interval }) => {
    const client = new QueryClient();
    const options = myLiveStreamQueryOptions(api);
    client.setQueryData(options.queryKey, liveNow({ status }));
    const query = new QueryObserver(client, options).getCurrentQuery();

    expect(
      query && typeof options.refetchInterval === 'function' && options.refetchInterval(query)
    ).toBe(interval);
  });

  it('fetches an overlay by its token, and polls it for the subscriber count', async () => {
    apiServer.use(overlayApi({ count: 7 }));
    const options = liveOverlayQueryOptions(api, OVERLAY_TOKEN);

    const overlay = await new QueryClient().fetchQuery(options);

    expect(overlay.subscriberCount).toBe(7);
    expect(options.refetchInterval).toBe(LIVE_POLL_MS);
  });
});
