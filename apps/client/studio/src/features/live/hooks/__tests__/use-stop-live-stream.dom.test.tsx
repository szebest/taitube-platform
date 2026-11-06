import { QueryClient } from '@tanstack/react-query';
import { apiServer, LIVE_STREAM_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { signedIn } from '#app/__tests__/providers';
import { liveApi, liveNow } from '#app/features/live/__tests__/live-api.fixture';
import { liveKeys } from '#app/features/live/api/live-queries';
import { useStopLiveStream } from '../use-stop-live-stream';

async function stopBroadcast() {
  const client = new QueryClient();
  const { handlers, stops } = liveApi(liveNow());
  apiServer.use(...handlers);
  client.setQueryData(liveKeys.mine(), liveNow());
  await runMutation(client, () => useStopLiveStream(LIVE_STREAM_ID), undefined, signedIn());
  return { client, stops };
}

describe('apps/client/studio: useStopLiveStream', () => {
  it('stops the stream by its id', async () => {
    const { stops } = await stopBroadcast();

    expect(stops).toEqual([LIVE_STREAM_ID]);
  });

  it('writes the ended stream the 202 carried into the cache the dashboard reads', async () => {
    const { client } = await stopBroadcast();

    expect(client.getQueryData(liveKeys.mine())).toMatchObject({ status: 'ENDED', ingest: null });
  });
});
