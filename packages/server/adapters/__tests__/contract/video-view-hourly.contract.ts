import { randomUUID } from 'node:crypto';
import type { VideoViewRepositoryPort } from '@vp/core/repositories';
import type { HourlyViewCount } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const HOUR = '2026-03-10T13:00:00.000Z';
const NEXT_HOUR = '2026-03-10T14:00:00.000Z';
const WINDOW = { from: '2026-03-09T15:00:00.000Z', to: NEXT_HOUR };

function hour(videoId: string, viewHour: string, views: number): HourlyViewCount {
  return { videoId, viewHour, views };
}

export function describeVideoViewHourlyContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoViewRepository hourly contract', () => {
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
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.c, ownerId: OTHER_OWNER_ID }));
    });

    const apply = async (...hourly: HourlyViewCount[]) =>
      expectOk(
        await views.applyBatch({ batchId: randomUUID(), counts: [], retention: [], hourly })
      );

    it('adds the hours of every batch onto the rows there, inside the window only, oldest first', async () => {
      await apply(hour(VIDEO_IDS.a, NEXT_HOUR, 1), hour(VIDEO_IDS.a, HOUR, 2));
      await apply(hour(VIDEO_IDS.a, HOUR, 3), hour(VIDEO_IDS.a, '2026-03-09T14:00:00.000Z', 9));

      expect(expectOk(await views.videoHourly(VIDEO_IDS.a, WINDOW))).toEqual([
        { viewHour: HOUR, views: 5 },
        { viewHour: NEXT_HOUR, views: 1 },
      ]);
    });

    it('applies the hours of a batch id once', async () => {
      const batch = {
        batchId: randomUUID(),
        counts: [],
        retention: [],
        hourly: [hour(VIDEO_IDS.a, HOUR, 2)],
      };
      expectOk(await views.applyBatch(batch));
      expectOk(await views.applyBatch(batch));

      expect(expectOk(await views.videoHourly(VIDEO_IDS.a, WINDOW))).toEqual([
        { viewHour: HOUR, views: 2 },
      ]);
    });

    it('drops the hours of a video that no longer exists', async () => {
      await apply(hour(randomUUID(), HOUR, 4), hour(VIDEO_IDS.a, HOUR, 1));

      expect(expectOk(await views.videoHourly(VIDEO_IDS.a, WINDOW))).toEqual([
        { viewHour: HOUR, views: 1 },
      ]);
    });

    it("sums a channel's hours over its owner's live videos alone", async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.d, deletedAt: new Date() }));
      await apply(
        hour(VIDEO_IDS.a, HOUR, 2),
        hour(VIDEO_IDS.b, HOUR, 3),
        hour(VIDEO_IDS.b, NEXT_HOUR, 1),
        hour(VIDEO_IDS.c, HOUR, 50),
        hour(VIDEO_IDS.d, HOUR, 7)
      );

      expect(expectOk(await views.channelHourly(OWNER_ID, WINDOW))).toEqual([
        { viewHour: HOUR, views: 5 },
        { viewHour: NEXT_HOUR, views: 1 },
      ]);
    });

    it('forgets the hours before a cutoff, and only those', async () => {
      await apply(hour(VIDEO_IDS.a, HOUR, 1), hour(VIDEO_IDS.a, NEXT_HOUR, 1));

      expect(expectOk(await views.forgetHoursBefore(new Date(NEXT_HOUR)))).toBe(1);
      expect(expectOk(await views.videoHourly(VIDEO_IDS.a, WINDOW))).toEqual([
        { viewHour: NEXT_HOUR, views: 1 },
      ]);
    });
  });
}
