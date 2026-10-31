import { renderHook, waitFor } from '@testing-library/react';
import { SYNC_CHANNEL, type SyncMessage } from '#app/sw/sync-messages';
import { useQueuedChanges } from '../use-queued-changes';

function workerSays(...messages: SyncMessage[]) {
  const worker = new BroadcastChannel(SYNC_CHANNEL);
  for (const message of messages) {
    worker.postMessage(message);
  }
  worker.close();
}

describe('apps/client/web: useQueuedChanges', () => {
  it('starts at zero', () => {
    const { result } = renderHook(() => useQueuedChanges());

    expect(result.current).toBe(0);
  });

  it.each<{ name: string; message: SyncMessage; expected: number }>([
    { name: 'a queued change', message: { type: 'pending', pending: 2 }, expected: 2 },
    {
      name: 'a finished replay',
      message: { type: 'replayed', pending: 0, videoIds: [] },
      expected: 0,
    },
  ])('follows $name', async ({ message, expected }) => {
    const { result } = renderHook(() => useQueuedChanges());
    workerSays({ type: 'pending', pending: 4 });
    await waitFor(() => expect(result.current).toBe(4));

    workerSays(message);

    await waitFor(() => expect(result.current).toBe(expected));
  });

  it('ignores a status request, and keeps following what comes after it', async () => {
    const { result } = renderHook(() => useQueuedChanges());

    workerSays({ type: 'pending', pending: 4 }, { type: 'status-request' });
    await waitFor(() => expect(result.current).toBe(4));
    workerSays({ type: 'pending', pending: 5 });

    await waitFor(() => expect(result.current).toBe(5));
  });
});
