import { QueryClient } from '@tanstack/react-query';
import { apiServer, LIVE_STREAM_ID } from '@vp/web-testing';
import { runMutation } from '@vp/web-testing/dom';
import { signedIn } from '#app/__tests__/providers';
import { liveApi, liveStream } from '#app/features/live/__tests__/live-api.fixture';
import { liveKeys } from '#app/features/live/api/live-queries';
import { useUpdateLiveStream } from '../use-update-live-stream';

async function updateChatMode() {
  const client = new QueryClient();
  const { handlers, updates } = liveApi();
  apiServer.use(...handlers);
  client.setQueryData(liveKeys.mine(), liveStream());
  await runMutation(
    client,
    () => useUpdateLiveStream(LIVE_STREAM_ID),
    { chatSlowModeSeconds: 30, chatSubscribersOnly: true },
    signedIn()
  );
  return { client, updates };
}

describe('apps/client/studio: useUpdateLiveStream', () => {
  it('sends the changes for the stream', async () => {
    const { updates } = await updateChatMode();

    expect(updates).toEqual([{ chatSlowModeSeconds: 30, chatSubscribersOnly: true }]);
  });

  it('writes the stream the API returned into the cache the dashboard reads', async () => {
    const { client } = await updateChatMode();

    expect(client.getQueryData(liveKeys.mine())).toMatchObject({
      chat: { slowModeSeconds: 30, subscribersOnly: true },
    });
  });
});
