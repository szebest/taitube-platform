import { InMemoryCacheClient, InMemoryLivePresence } from '@vp/adapters/in-memory';
import { createLogger } from '@vp/logger';
import { expectOk } from '@vp/testing/result';
import { LiveViewerTracker } from '../live-viewer-tracker';
import { STREAM_ID, VIDEO_ID } from './live-harness';

function tracked() {
  const cache = new InMemoryCacheClient();
  let clock = 0;
  const tracker = new LiveViewerTracker({
    presence: new InMemoryLivePresence(),
    cache,
    windowMs: 40_000,
    now: () => clock,
    logger: createLogger({ format: 'json', service: 'tracker-spec', level: 'silent' }),
  });
  const counts = () =>
    cache.publishedMessages
      .filter(({ channel }) => channel === `video:${VIDEO_ID}`)
      .map(({ message }) => JSON.parse(message).data.viewers);
  return { tracker, counts, tick: (ms: number) => (clock += ms) };
}

describe('apps/server/api/services: LiveViewerTracker', () => {
  it('tells every viewer the count as viewers come and go', async () => {
    const { tracker, counts } = tracked();

    const first = await tracker.watch(STREAM_ID, VIDEO_ID);
    await tracker.watch(STREAM_ID, VIDEO_ID);
    await first.leave();

    expect(counts()).toEqual([1, 2, 1]);
  });

  it('keeps counting a viewer its pod still touches, past the window', async () => {
    const { tracker, tick } = tracked();
    await tracker.watch(STREAM_ID, VIDEO_ID);

    tick(30_000);
    await tracker.beat();
    tick(30_000);

    expect(expectOk(await tracker.viewers(STREAM_ID))).toBe(1);
  });

  it('stops counting a viewer nobody touched within the window', async () => {
    const { tracker, tick } = tracked();
    await tracker.watch(STREAM_ID, VIDEO_ID);

    tick(41_000);

    expect(expectOk(await tracker.viewers(STREAM_ID))).toBe(0);
  });
});
