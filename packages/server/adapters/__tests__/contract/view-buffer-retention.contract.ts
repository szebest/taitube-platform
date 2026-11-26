import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { ViewBatch } from '@vp/domain';
import type { MakeViewBufferSubject, ViewBufferSubject } from './view-buffer.contract';

export function describeViewBufferRetentionContract(makeSubject: MakeViewBufferSubject): void {
  describe('ViewBuffer retention contract', () => {
    let subject: ViewBufferSubject;
    let videoId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    const drainBatch = async (): Promise<ViewBatch | null> => {
      const batch = expectOk(await subject.buffer.snapshot(randomUUID()));
      if (batch) expectOk(await subject.buffer.release(batch.batchId));
      return batch;
    };

    beforeEach(async () => {
      videoId = randomUUID();
      await drainBatch();
      await drainBatch();
    });

    const reach = async (sessionId: string, percent: number) =>
      expectOk(await subject.buffer.recordRetention({ videoId, sessionId, percent }));

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

      const batch = expectOk(await subject.buffer.snapshot(first));
      const again = expectOk(await subject.buffer.snapshot(randomUUID()));
      expectOk(await subject.buffer.release(first));

      expect(batch).toEqual({
        batchId: first,
        counts: [],
        retention: expect.arrayContaining([{ videoId, percent: 5, viewers: 1 }]),
        hourly: [],
        devices: [],
        shareLinks: [],
        experiments: [],
      });
      expect(again).toEqual(batch);
      expect(expectOk(await subject.buffer.snapshot(randomUUID()))).toBeNull();
    });

    it('keeps the steps recorded after a snapshot for the batch after it', async () => {
      const first = randomUUID();
      await reach(randomUUID(), 0);
      const batch = expectOk(await subject.buffer.snapshot(first));
      await reach(randomUUID(), 5);
      expectOk(await subject.buffer.release(first));

      expect(batch?.retention).toEqual([{ videoId, percent: 0, viewers: 1 }]);
      expect(await drainSteps()).toEqual([
        { videoId, percent: 0, viewers: 1 },
        { videoId, percent: 5, viewers: 1 },
      ]);
    });
  });
}
