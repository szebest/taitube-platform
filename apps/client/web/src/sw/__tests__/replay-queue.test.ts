import type { Queue } from 'workbox-background-sync';
import { replayQueue } from '../replay-queue';

type QueuedEntry = NonNullable<Awaited<ReturnType<Queue['shiftRequest']>>>;

function entryFor(href: string, method = 'PUT'): QueuedEntry {
  return { request: new Request(href, { method, body: '{}' }), timestamp: 0 };
}

const reactions = (id: string) => entryFor(`https://taitube.test/api/v1/videos/${id}/reactions`);

function fakeQueue(entries: QueuedEntry[]) {
  const held = [...entries];
  return {
    held,
    shiftRequest: vi.fn(async () => held.shift()),
    unshiftRequest: vi.fn(async (entry: QueuedEntry) => {
      held.unshift(entry);
    }),
    size: vi.fn(async () => held.length),
  };
}

describe('apps/client/web: replayQueue', () => {
  it('sends every request, then reports the videos it settled and nothing pending', async () => {
    const queue = fakeQueue([reactions('v1'), reactions('v2')]);
    const report = vi.fn();
    const send = vi.fn(async () => new Response(null, { status: 200 }));

    await replayQueue(queue, report, send);

    expect(send).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenCalledWith({ type: 'replayed', pending: 0, videoIds: ['v1', 'v2'] });
  });

  it.each([
    { name: 'unauthorised', status: 401 },
    { name: 'invalid', status: 422 },
    { name: 'a conflict', status: 409 },
  ])('drops a request the server answered $status', async ({ status }) => {
    const queue = fakeQueue([reactions('v1')]);

    await replayQueue(
      queue,
      vi.fn(),
      vi.fn(async () => new Response(null, { status }))
    );

    expect(queue.held).toEqual([]);
    expect(queue.unshiftRequest).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'a network error', send: async () => Promise.reject(new TypeError('offline')) },
    { name: 'a 503', send: async () => new Response(null, { status: 503 }) },
  ])('keeps the request and asks for another attempt after $name', async ({ send }) => {
    const queue = fakeQueue([reactions('v1'), reactions('v2')]);
    const report = vi.fn();

    await expect(replayQueue(queue, report, send)).rejects.toThrow('Replay incomplete');

    expect(queue.held).toHaveLength(2);
    expect(report).toHaveBeenCalledWith({ type: 'replayed', pending: 2, videoIds: [] });
  });
});
