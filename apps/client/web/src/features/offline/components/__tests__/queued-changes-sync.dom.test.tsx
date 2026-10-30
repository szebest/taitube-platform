import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createQueryClient, videoQueryOptions } from '@vp/queries';
import { api, VIDEO_ID } from '@vp/web-testing';
import { AppProviders } from '#app/__tests__/providers';
import { myReactionQueryOptions } from '#app/features/reactions/api/reaction-queries';
import { commentKeys } from '#app/features/watch/api/comment-queries';
import { SYNC_CHANNEL, type SyncMessage } from '#app/sw/sync-messages';
import { QueuedChangesSync } from '../queued-changes-sync';

const keys = {
  reaction: myReactionQueryOptions(api, VIDEO_ID).queryKey,
  video: videoQueryOptions(api, VIDEO_ID).queryKey,
  comments: commentKeys.list(VIDEO_ID, 'top'),
  other: commentKeys.list('other-video', 'top'),
};

function mounted() {
  const client = createQueryClient();
  for (const key of Object.values(keys)) {
    client.setQueryData(key, {});
  }
  render(
    <QueryClientProvider client={client}>
      <AppProviders>
        <QueuedChangesSync />
      </AppProviders>
    </QueryClientProvider>
  );
  return client;
}

async function workerSays(message: SyncMessage) {
  const worker = new BroadcastChannel(SYNC_CHANNEL);
  worker.postMessage(message);
  worker.close();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

const stale = (client: ReturnType<typeof mounted>) =>
  Object.values(keys).map((key) => client.getQueryState(key)?.isInvalidated);

describe('apps/client/web: QueuedChangesSync', () => {
  it('marks the reaction, the counts and the comments of each replayed video stale', async () => {
    const client = mounted();

    await workerSays({ type: 'replayed', pending: 0, videoIds: [VIDEO_ID] });

    expect(stale(client)).toEqual([true, true, true, false]);
  });

  it.each([
    { name: 'a queued change', message: { type: 'pending', pending: 1 } },
    { name: 'a status request', message: { type: 'status-request' } },
  ] as const)('leaves the cache alone on $name', async ({ message }) => {
    const client = mounted();

    await workerSays(message);

    expect(stale(client)).toEqual([false, false, false, false]);
  });
});
