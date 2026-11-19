import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { PlaybackWatch } from '@vp/core/ports';
import type { ViewBatch } from '@vp/domain';
import type { MakeViewBufferSubject, ViewBufferSubject } from './view-buffer.contract';

const DAY = '2026-03-10';
const NEXT_DAY = '2026-03-11';
const HOUR = '2026-03-10T13:00:00.000Z';

export function describeViewBufferDeviceContract(makeSubject: MakeViewBufferSubject): void {
  describe('ViewBuffer device contract', () => {
    let subject: ViewBufferSubject;
    let videoId: string;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    const drain = async (): Promise<ViewBatch | null> => {
      const batch = expectOk(await subject.buffer.snapshot(randomUUID()));
      if (batch) expectOk(await subject.buffer.release(batch.batchId));
      return batch;
    };

    beforeEach(async () => {
      videoId = randomUUID();
      await drain();
      await drain();
    });

    const playback = (overrides: Partial<PlaybackWatch>): PlaybackWatch => ({
      videoId,
      sessionId: randomUUID(),
      viewDate: DAY,
      viewHour: HOUR,
      device: 'desktop',
      watchedSeconds: 6,
      requiredSeconds: 5,
      ...overrides,
    });

    const play = async (event: PlaybackWatch) =>
      expectOk(await subject.buffer.recordPlayback(event));

    it('counts the device of each counted view per video and day, and of nothing else', async () => {
      await play(playback({ device: 'mobile' }));
      await play(playback({ device: 'mobile' }));
      await play(playback({ device: 'tablet' }));
      await play(playback({ device: 'unknown', viewDate: NEXT_DAY }));
      await play(playback({ device: 'desktop', watchedSeconds: 2 }));
      const repeated = playback({ device: 'desktop' });
      await play(repeated);
      await play({ ...repeated, device: 'mobile' });

      expect((await drain())?.devices.filter((count) => count.videoId === videoId)).toEqual(
        expect.arrayContaining([
          { videoId, viewDate: DAY, device: 'mobile', views: 2 },
          { videoId, viewDate: DAY, device: 'tablet', views: 1 },
          { videoId, viewDate: DAY, device: 'desktop', views: 1 },
          { videoId, viewDate: NEXT_DAY, device: 'unknown', views: 1 },
        ])
      );
    });

    it('hands the unreleased batch back with its device counts, and keeps later ones for the batch after it', async () => {
      const first = randomUUID();
      await play(playback({ device: 'mobile' }));
      expectOk(await subject.buffer.snapshot(first));
      await play(playback({ device: 'tablet' }));

      const retried = expectOk(await subject.buffer.snapshot(randomUUID()));
      expectOk(await subject.buffer.release(first));
      const next = await drain();

      expect(retried?.devices).toEqual([{ videoId, viewDate: DAY, device: 'mobile', views: 1 }]);
      expect(next?.devices).toEqual([{ videoId, viewDate: DAY, device: 'tablet', views: 1 }]);
    });
  });
}
