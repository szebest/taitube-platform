import { act, renderHook } from '@testing-library/react';
import { SYNC_CHANNEL, type SyncMessage } from '#app/sw/sync-messages';
import { useQueuedChanges } from '../use-queued-changes';

async function workerSays(message: SyncMessage) {
  const worker = new BroadcastChannel(SYNC_CHANNEL);
  worker.postMessage(message);
  worker.close();
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
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
    { name: 'a status request', message: { type: 'status-request' }, expected: 0 },
  ])('follows $name', async ({ message, expected }) => {
    const { result } = renderHook(() => useQueuedChanges());

    await workerSays(message);

    expect(result.current).toBe(expected);
  });
});
