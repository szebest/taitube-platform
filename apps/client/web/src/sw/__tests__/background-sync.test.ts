import { Queue } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { registerBackgroundSync } from '../background-sync';
import { replayQueue } from '../replay-queue';

vi.mock(import('workbox-background-sync'), () => ({ Queue: vi.fn() as never }));
vi.mock(import('workbox-routing'), () => ({ registerRoute: vi.fn() }));
vi.mock(import('workbox-strategies'), () => ({ NetworkOnly: vi.fn() }));
vi.mock(import('../replay-queue'), () => ({ replayQueue: vi.fn() as never }));

const ORIGIN = 'https://taitube.test';

function setup(size = 1) {
  const queue = { pushRequest: vi.fn(), size: vi.fn(async () => size) };
  Object.assign(Queue.prototype, queue);
  const listeners: ((event: MessageEvent<unknown>) => Promise<void> | void)[] = [];
  const channel = {
    postMessage: vi.fn(),
    addEventListener: vi.fn((_type, listener) => listeners.push(listener)),
  };
  registerBackgroundSync(ORIGIN, channel);
  return { queue, channel, listeners };
}

describe('apps/client/web: registerBackgroundSync', () => {
  it('queues reactions as PUT and comments as POST, each by its own route', () => {
    setup();

    expect(vi.mocked(registerRoute).mock.calls.map(([, , method]) => method)).toEqual([
      'PUT',
      'POST',
    ]);
    const [reactionMatcher, commentMatcher] = vi
      .mocked(registerRoute)
      .mock.calls.map(([matcher]) => matcher as (options: { url: URL }) => boolean);
    expect(reactionMatcher?.({ url: new URL(`${ORIGIN}/api/v1/videos/v1/reactions`) })).toBe(true);
    expect(reactionMatcher?.({ url: new URL(`${ORIGIN}/api/v1/videos/v1/comments`) })).toBe(false);
    expect(commentMatcher?.({ url: new URL(`${ORIGIN}/api/v1/videos/v1/comments`) })).toBe(true);
  });

  it('names a versioned queue that keeps a call for a day', () => {
    setup();

    expect(Queue).toHaveBeenCalledWith(
      'taitube-sync-v1',
      expect.objectContaining({ maxRetentionTime: 1440 })
    );
  });

  it('queues a call whose fetch failed and reports how many wait', async () => {
    const { queue, channel } = setup(3);
    const [[options]] = vi.mocked(NetworkOnly).mock.calls as [
      [{ plugins: { fetchDidFail: (arg: { request: Request }) => Promise<void> }[] }],
    ];
    const request = new Request(`${ORIGIN}/api/v1/videos/v1/reactions`, { method: 'PUT' });

    await options.plugins[0]?.fetchDidFail({ request });

    expect(queue.pushRequest).toHaveBeenCalledWith({ request });
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'pending', pending: 3 });
  });

  it('replays through replayQueue with the channel as its report', () => {
    const { channel } = setup();
    const [, options] = vi.mocked(Queue).mock.calls[0] ?? [];
    const due = {} as Queue;

    void options?.onSync?.({ queue: due });
    const [, report] = vi.mocked(replayQueue).mock.calls[0] ?? [];
    report?.({ type: 'pending', pending: 0 });

    expect(replayQueue).toHaveBeenCalledWith(due, expect.any(Function), fetch);
    expect(channel.postMessage).toHaveBeenCalledWith({ type: 'pending', pending: 0 });
  });

  it.each([
    { name: 'a status request', data: { type: 'status-request' }, replies: true },
    { name: 'another message', data: { type: 'pending', pending: 1 }, replies: false },
    { name: 'a string', data: 'status-request', replies: false },
  ])('answers $name: $replies', async ({ data, replies }) => {
    const { channel, listeners } = setup(2);

    await listeners[0]?.(new MessageEvent('message', { data }));

    expect(channel.postMessage).toHaveBeenCalledTimes(replies ? 1 : 0);
  });
});
