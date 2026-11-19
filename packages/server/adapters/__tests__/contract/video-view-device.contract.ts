import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import type { VideoViewRepositoryPort } from '@vp/core/repositories';
import type { DeviceViewCount, ViewDevice } from '@vp/domain';
import { VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const DAY = '2026-03-10';
const NEXT_DAY = '2026-03-11';
const LATER_DAY = '2026-03-20';
const WEEK = { from: '2026-03-05', to: '2026-03-11' };

function device(
  videoId: string,
  viewDate: string,
  deviceClass: ViewDevice,
  views: number
): DeviceViewCount {
  return { videoId, viewDate, device: deviceClass, views };
}

export function describeVideoViewDeviceContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoViewRepository device contract', () => {
    let subject: RepositoriesSubject;
    let views: VideoViewRepositoryPort;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      views = subject.repositories.videoViews;
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
    });

    const apply = async (...devices: DeviceViewCount[]) =>
      expectOk(
        await views.applyBatch({
          batchId: randomUUID(),
          counts: [],
          retention: [],
          hourly: [],
          devices,
        })
      );

    it('adds the device counts of every batch onto the rows there, summed over the range, most viewed first', async () => {
      await apply(
        device(VIDEO_IDS.a, DAY, 'mobile', 2),
        device(VIDEO_IDS.a, DAY, 'desktop', 3),
        device(VIDEO_IDS.a, LATER_DAY, 'tablet', 9)
      );
      await apply(
        device(VIDEO_IDS.a, DAY, 'mobile', 4),
        device(VIDEO_IDS.a, NEXT_DAY, 'mobile', 1)
      );

      expect(expectOk(await views.videoDevices(VIDEO_IDS.a, WEEK))).toEqual([
        { device: 'mobile', views: 7 },
        { device: 'desktop', views: 3 },
      ]);
    });

    it('reads one video alone, and nothing for a video with no device rows', async () => {
      await apply(device(VIDEO_IDS.b, DAY, 'mobile', 5));

      expect(expectOk(await views.videoDevices(VIDEO_IDS.a, WEEK))).toEqual([]);
    });

    it('applies the device counts of a batch id once', async () => {
      const batch = {
        batchId: randomUUID(),
        counts: [],
        retention: [],
        hourly: [],
        devices: [device(VIDEO_IDS.a, DAY, 'mobile', 2)],
      };

      expectOk(await views.applyBatch(batch));
      expect(expectOk(await views.applyBatch(batch))).toEqual({ type: 'already-applied' });

      expect(expectOk(await views.videoDevices(VIDEO_IDS.a, WEEK))).toEqual([
        { device: 'mobile', views: 2 },
      ]);
    });

    it('drops the device counts of a video that no longer exists', async () => {
      await apply(device(randomUUID(), DAY, 'mobile', 2), device(VIDEO_IDS.a, DAY, 'desktop', 1));

      expect(expectOk(await views.videoDevices(VIDEO_IDS.a, WEEK))).toEqual([
        { device: 'desktop', views: 1 },
      ]);
    });
  });
}
