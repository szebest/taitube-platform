import { randomUUID } from 'node:crypto';
import type { ViewBufferPort, ViewEvent } from '@vp/core/ports';
import type { ViewCount } from '@vp/domain';
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

    const drain = async (): Promise<readonly ViewCount[]> => {
      const batch = expectOk(await buffer.snapshot(randomUUID()));
      if (!batch) return [];
      expectOk(await buffer.release(batch.batchId));
      return batch.counts;
    };

    beforeEach(async () => {
      videoId = randomUUID();
      await drain();
      await drain();
    });

    const view = (overrides: Partial<ViewEvent> = {}): ViewEvent => ({
      videoId,
      viewerId: randomUUID(),
      viewDate: DAY,
      watchSeconds: 30,
      ...overrides,
    });

    it('counts a viewer once per video and day, with the watch time of the counted view', async () => {
      const viewerId = randomUUID();

      expect(expectOk(await buffer.record(view({ viewerId })))).toBe('counted');
      expect(expectOk(await buffer.record(view({ viewerId, watchSeconds: 90 })))).toBe('duplicate');

      expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 1, watchSeconds: 30 }]);
    });

    it('counts the same viewer again on another day', async () => {
      const viewerId = randomUUID();
      expectOk(await buffer.record(view({ viewerId })));

      expect(expectOk(await buffer.record(view({ viewerId, viewDate: NEXT_DAY })))).toBe('counted');
    });

    it('sums distinct viewers of one video and day into one count', async () => {
      for (const watchSeconds of [10, 20, 30]) {
        expectOk(await buffer.record(view({ watchSeconds })));
      }

      expect(await drain()).toEqual([{ videoId, viewDate: DAY, views: 3, watchSeconds: 60 }]);
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

      expect(retried).toEqual({ batchId: first, counts: [expect.objectContaining({ views: 1 })] });
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
      const seen = view({ watchSeconds: 5 });
      expectOk(await buffer.record(seen));

      const outcomes = expectOk(
        await buffer.recordAll([
          view({ viewerId: seen.viewerId, watchSeconds: 50 }),
          view({ watchSeconds: 7 }),
          view({ viewDate: NEXT_DAY, watchSeconds: 12 }),
        ])
      );

      expect(outcomes).toEqual(['duplicate', 'counted', 'counted']);
      expect(await drain()).toEqual(
        expect.arrayContaining([
          { videoId, viewDate: DAY, views: 2, watchSeconds: 12 },
          { videoId, viewDate: NEXT_DAY, views: 1, watchSeconds: 12 },
        ])
      );
    });

    it('records an empty set of views as nothing', async () => {
      expect(expectOk(await buffer.recordAll([]))).toEqual([]);
      expect(await drain()).toEqual([]);
    });
  });
}
