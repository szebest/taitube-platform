import { randomUUID } from 'node:crypto';
import type { PlaybackWatch, ViewBufferPort, ViewEvent } from '@vp/core/ports';
import type { ViewBatch, ViewCount } from '@vp/domain';
import { expectOk } from '@vp/testing/result';

export interface ViewBufferSubject {
  readonly buffer: ViewBufferPort;
  close(): Promise<void>;
}

export type MakeViewBufferSubject = () => Promise<ViewBufferSubject>;

const DAY = '2026-03-10';
const NEXT_DAY = '2026-03-11';

export function describeViewBufferContract(makeSubject: MakeViewBufferSubject): void {
  describe('ViewBuffer contract', () => {
    let subject: ViewBufferSubject;
    let buffer: ViewBufferPort;
    let videoId: string;

    beforeAll(async () => {
      subject = await makeSubject();
      buffer = subject.buffer;
    });

    afterAll(async () => {
      await subject.close();
    });

    const drainBatch = async (): Promise<ViewBatch | null> => {
      const batch = expectOk(await buffer.snapshot(randomUUID()));
      if (batch) expectOk(await buffer.release(batch.batchId));
      return batch;
    };

    const drain = async (): Promise<readonly ViewCount[]> => (await drainBatch())?.counts ?? [];

    beforeEach(async () => {
      videoId = randomUUID();
      await drain();
      await drain();
    });

    const view = (overrides: Partial<ViewEvent> = {}): ViewEvent => ({
      videoId,
      viewerId: randomUUID(),
      viewDate: DAY,
      ...overrides,
    });

    it('counts a viewer once per video and day', async () => {
      const viewerId = randomUUID();

      expect(expectOk(await buffer.record(view({ viewerId })))).toBe('counted');
      expect(expectOk(await buffer.record(view({ viewerId })))).toBe('duplicate');

      expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 1, watchSeconds: 0 }]);
    });

    it('counts the same viewer again on another day', async () => {
      const viewerId = randomUUID();
      expectOk(await buffer.record(view({ viewerId })));

      expect(expectOk(await buffer.record(view({ viewerId, viewDate: NEXT_DAY })))).toBe('counted');
    });

    it('sums distinct viewers of one video and day into one count', async () => {
      for (let viewers = 0; viewers < 3; viewers++) expectOk(await buffer.record(view()));

      expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 3, watchSeconds: 0 }]);
    });

    it('snapshots nothing when nothing is buffered', async () => {
      expect(expectOk(await buffer.snapshot(randomUUID()))).toBeNull();
    });

    it('hands back the unreleased batch, and keeps later views for the batch after it', async () => {
      const first = randomUUID();
      expectOk(await buffer.record(view()));
      expectOk(await buffer.snapshot(first));
      expectOk(await buffer.record(view()));

      const retried = expectOk(await buffer.snapshot(randomUUID()));
      expectOk(await buffer.release(first));
      const next = expectOk(await buffer.snapshot(randomUUID()));

      expect(retried).toEqual({
        batchId: first,
        counts: [expect.objectContaining({ views: 1 })],
        retention: [],
      });
      expect(next?.batchId).not.toBe(first);
      expect(next?.counts).toEqual([expect.objectContaining({ videoId, views: 1 })]);
    });

    it('ignores the release of a batch that is not the pending one', async () => {
      const pending = randomUUID();
      expectOk(await buffer.record(view()));
      expectOk(await buffer.snapshot(pending));

      expectOk(await buffer.release(randomUUID()));

      expect(expectOk(await buffer.snapshot(randomUUID()))?.batchId).toBe(pending);
    });

    it('records many views at once against the same dedup, outcomes in input order', async () => {
      const seen = view();
      expectOk(await buffer.record(seen));

      const outcomes = expectOk(
        await buffer.recordAll([
          view({ viewerId: seen.viewerId }),
          view(),
          view({ viewDate: NEXT_DAY }),
        ])
      );

      expect(outcomes).toEqual(['duplicate', 'counted', 'counted']);
      expect(await drain()).toEqual(
        expect.arrayContaining([
          { videoId, viewDate: DAY, views: 2, watchSeconds: 0 },
          { videoId, viewDate: NEXT_DAY, views: 1, watchSeconds: 0 },
        ])
      );
    });

    it('records an empty set of views as nothing', async () => {
      expect(expectOk(await buffer.recordAll([]))).toEqual([]);
      expect(await drain()).toEqual([]);
    });

    describe('playback', () => {
      const playback = (overrides: Partial<PlaybackWatch> = {}): PlaybackWatch => ({
        videoId,
        sessionId: randomUUID(),
        viewDate: DAY,
        watchedSeconds: 3,
        requiredSeconds: 5,
        ...overrides,
      });

      const play = async (event: PlaybackWatch) => expectOk(await buffer.recordPlayback(event));

      it('adds every second played to the day, and counts the view once the session reaches the minimum', async () => {
        const event = playback();

        expect(await play(event)).toBe('pending');
        expect(await play(event)).toBe('counted');
        expect(await play({ ...event, watchedSeconds: 30 })).toBe('pending');

        expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 1, watchSeconds: 36 }]);
      });

      it('keeps the watch time of a session that never reaches the minimum, with no view', async () => {
        expect(await play(playback({ watchedSeconds: 2 }))).toBe('pending');

        expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 0, watchSeconds: 2 }]);
      });

      it('adds up fractions of a second across events instead of rounding each one', async () => {
        const event = playback({ watchedSeconds: 0.6, requiredSeconds: 100 });

        for (let events = 0; events < 5; events++) await play(event);

        expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 0, watchSeconds: 3 }]);
      });

      it('shares the dedup of a view recorded for the same viewer the same day', async () => {
        const event = playback({ watchedSeconds: 6 });
        expectOk(await buffer.record({ videoId, viewerId: event.sessionId, viewDate: DAY }));

        expect(await play(event)).toBe('duplicate');

        expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 1, watchSeconds: 6 }]);
      });

      it('counts two sessions as two views and sums their watch time', async () => {
        await play(playback({ watchedSeconds: 10 }));
        await play(playback({ watchedSeconds: 20 }));

        expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 2, watchSeconds: 30 }]);
      });
    });

    describe('retention', () => {
      const reach = async (sessionId: string, percent: number) =>
        expectOk(await buffer.recordRetention({ videoId, sessionId, percent }));

      const drainSteps = async () =>
        (await drainBatch())?.retention.filter((count) => count.videoId === videoId) ?? [];

      it('counts a session at every step it reached, once, however many beacons it sends', async () => {
        const sessionId = randomUUID();

        await reach(sessionId, 10);
        await reach(sessionId, 10);
        await reach(sessionId, 20);
        await reach(sessionId, 5);

        expect(await drainSteps()).toEqual(
          [0, 5, 10, 15, 20].map((percent) => ({ videoId, percent, viewers: 1 }))
        );
      });

      it('sums distinct sessions per step and empties the buffer on release', async () => {
        await reach(randomUUID(), 5);
        await reach(randomUUID(), 0);

        expect(await drainSteps()).toEqual(
          expect.arrayContaining([
            { videoId, percent: 0, viewers: 2 },
            { videoId, percent: 5, viewers: 1 },
          ])
        );
        expect(await drainSteps()).toEqual([]);
      });

      it('snapshots a buffer holding only retention steps, and hands the same batch back until release', async () => {
        const first = randomUUID();
        await reach(randomUUID(), 5);

        const batch = expectOk(await buffer.snapshot(first));
        const again = expectOk(await buffer.snapshot(randomUUID()));
        expectOk(await buffer.release(first));

        expect(batch).toEqual({
          batchId: first,
          counts: [],
          retention: expect.arrayContaining([{ videoId, percent: 5, viewers: 1 }]),
        });
        expect(again).toEqual(batch);
        expect(expectOk(await buffer.snapshot(randomUUID()))).toBeNull();
      });

      it('keeps the steps recorded after a snapshot for the batch after it', async () => {
        const first = randomUUID();
        await reach(randomUUID(), 0);
        const batch = expectOk(await buffer.snapshot(first));
        await reach(randomUUID(), 5);
        expectOk(await buffer.release(first));

        expect(batch?.retention).toEqual([{ videoId, percent: 0, viewers: 1 }]);
        expect(await drainSteps()).toEqual([
          { videoId, percent: 0, viewers: 1 },
          { videoId, percent: 5, viewers: 1 },
        ]);
      });
    });
  });
}
