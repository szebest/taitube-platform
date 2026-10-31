import { SYNC_CHANNEL, type SyncMessage } from '#app/sw/sync-messages';
import { listenForSync } from '../sync-channel';

describe('apps/client/web: listenForSync', () => {
  it('hands over what the worker posts and asks for its status first', async () => {
    const worker = new BroadcastChannel(SYNC_CHANNEL);
    const asked = new Promise<unknown>((resolve) => {
      worker.addEventListener('message', ({ data }) => resolve(data), { once: true });
    });
    const heard: SyncMessage[] = [];
    const stop = listenForSync((message) => heard.push(message));

    expect(await asked).toEqual({ type: 'status-request' });
    worker.postMessage({ type: 'pending', pending: 2 });
    worker.postMessage({ type: 'replayed', pending: 0, videoIds: ['v1'] });
    await vi.waitFor(() => expect(heard).toHaveLength(2));

    expect(heard).toEqual([
      { type: 'pending', pending: 2 },
      { type: 'replayed', pending: 0, videoIds: ['v1'] },
    ]);
    stop();
    worker.close();
  });

  it.each([
    { name: 'an unknown type', data: { type: 'other', pending: 1 } },
    { name: 'a negative count', data: { type: 'pending', pending: -1 } },
    { name: 'a string', data: 'pending' },
  ])('ignores $name', async ({ data }) => {
    const worker = new BroadcastChannel(SYNC_CHANNEL);
    const heard: SyncMessage[] = [];
    const stop = listenForSync((message) => heard.push(message));

    worker.postMessage(data);
    worker.postMessage({ type: 'pending', pending: 5 });
    await vi.waitFor(() => expect(heard).toHaveLength(1));

    expect(heard).toEqual([{ type: 'pending', pending: 5 }]);
    stop();
    worker.close();
  });

  it('does nothing without BroadcastChannel', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    const onMessage = vi.fn();

    listenForSync(onMessage)();

    expect(onMessage).not.toHaveBeenCalled();
  });
});
