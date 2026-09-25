import { randomUUID } from 'node:crypto';
import type { VideoViewRepositoryPort } from '@vp/core/repositories';
import type { ViewCount } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const DAY = '2026-03-10';
const NEXT_DAY = '2026-03-11';
const WEEK = { from: '2026-03-05', to: '2026-03-11' };

function count(
  videoId: string,
  viewDate: string,
  views: number,
  watchSeconds = views * 10
): ViewCount {
  return { videoId, viewDate, views, watchSeconds };
}

export function describeVideoViewRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoViewRepository contract', () => {
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
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a, title: 'Alpha' }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b, title: 'Beta' }));
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.c, ownerId: OTHER_OWNER_ID }));
    });

    const apply = async (...counts: ViewCount[]) =>
      expectOk(await views.applyBatch({ batchId: randomUUID(), counts }));

    const viewsCountOf = async (videoId: string) =>
      expectOk(await subject.repositories.videos.findById(videoId))?.viewsCount;

    it('adds a batch to the video counters and the daily rows in one step', async () => {
      const outcome = await apply(
        count(VIDEO_IDS.a, DAY, 3),
        count(VIDEO_IDS.a, NEXT_DAY, 2),
        count(VIDEO_IDS.b, DAY, 1)
      );

      expect(outcome).toEqual({ type: 'applied', views: 6 });
      expect(await viewsCountOf(VIDEO_IDS.a)).toBe(5);
      expect(await viewsCountOf(VIDEO_IDS.b)).toBe(1);
      expect(expectOk(await views.videoTimeline(VIDEO_IDS.a, WEEK))).toEqual([
        { viewDate: DAY, views: 3, watchSeconds: 30 },
        { viewDate: NEXT_DAY, views: 2, watchSeconds: 20 },
      ]);
    });

    it('applies a batch id once, so a flush retried after a crash counts nothing twice', async () => {
      const batch = { batchId: randomUUID(), counts: [count(VIDEO_IDS.a, DAY, 4)] };
      expectOk(await views.applyBatch(batch));

      expect(expectOk(await views.applyBatch(batch))).toEqual({ type: 'already-applied' });
      expect(await viewsCountOf(VIDEO_IDS.a)).toBe(4);
    });

    it('adds a later batch of the same day onto the row already there', async () => {
      await apply(count(VIDEO_IDS.a, DAY, 2, 15));
      await apply(count(VIDEO_IDS.a, DAY, 3, 25));

      expect(expectOk(await views.videoTimeline(VIDEO_IDS.a, WEEK))).toEqual([
        { viewDate: DAY, views: 5, watchSeconds: 40 },
      ]);
    });

    it('merges repeated counts inside one batch', async () => {
      await apply(count(VIDEO_IDS.a, DAY, 1), count(VIDEO_IDS.a, DAY, 2));

      expect(await viewsCountOf(VIDEO_IDS.a)).toBe(3);
    });

    it('drops the counts of a video that no longer exists and applies the rest', async () => {
      const outcome = await apply(count(randomUUID(), DAY, 9), count(VIDEO_IDS.a, DAY, 1));

      expect(outcome).toEqual({ type: 'applied', views: 1 });
      expect(await viewsCountOf(VIDEO_IDS.a)).toBe(1);
    });

    it('records an empty batch as applied', async () => {
      const batch = { batchId: randomUUID(), counts: [] };

      expect(expectOk(await views.applyBatch(batch))).toEqual({ type: 'applied', views: 0 });
      expect(expectOk(await views.applyBatch(batch))).toEqual({ type: 'already-applied' });
    });

    it('loses no increment when batches for one video commit concurrently', async () => {
      await Promise.all(Array.from({ length: 20 }, () => apply(count(VIDEO_IDS.a, DAY, 5))));

      expect(await viewsCountOf(VIDEO_IDS.a)).toBe(100);
      expect(expectOk(await views.videoTimeline(VIDEO_IDS.a, WEEK))[0]?.views).toBe(100);
    });

    it('forgets the batches applied before a cutoff, and only those', async () => {
      const batch = { batchId: randomUUID(), counts: [count(VIDEO_IDS.a, DAY, 1)] };
      expectOk(await views.applyBatch(batch));

      expect(expectOk(await views.forgetBatchesBefore(new Date(0)))).toBe(0);
      expect(expectOk(await views.forgetBatchesBefore(new Date(Date.now() + 60_000)))).toBe(1);
      expect(expectOk(await views.applyBatch(batch))).toEqual({ type: 'applied', views: 1 });
    });

    it('reads a video timeline inside the range only, oldest first', async () => {
      await apply(
        count(VIDEO_IDS.a, '2026-03-04', 7),
        count(VIDEO_IDS.a, NEXT_DAY, 1),
        count(VIDEO_IDS.a, '2026-03-05', 2)
      );

      expect(
        expectOk(await views.videoTimeline(VIDEO_IDS.a, WEEK)).map((day) => day.viewDate)
      ).toEqual(['2026-03-05', NEXT_DAY]);
    });

    it("sums a channel's timeline over its owner's videos alone", async () => {
      await apply(
        count(VIDEO_IDS.a, DAY, 2, 20),
        count(VIDEO_IDS.b, DAY, 3, 30),
        count(VIDEO_IDS.b, NEXT_DAY, 1, 10),
        count(VIDEO_IDS.c, DAY, 50)
      );

      expect(expectOk(await views.channelTimeline(OWNER_ID, WEEK))).toEqual([
        { viewDate: DAY, views: 5, watchSeconds: 50 },
        { viewDate: NEXT_DAY, views: 1, watchSeconds: 10 },
      ]);
    });

    it('totals the views and videos a channel owns, leaving out a deleted one', async () => {
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.d, deletedAt: new Date() }));
      await apply(
        count(VIDEO_IDS.a, DAY, 4),
        count(VIDEO_IDS.b, DAY, 6),
        count(VIDEO_IDS.d, DAY, 9)
      );

      expect(expectOk(await views.channelTotals(OWNER_ID))).toEqual({
        totalViews: 10,
        videoCount: 2,
      });
      expect(expectOk(await views.channelTotals(randomUUID()))).toEqual({
        totalViews: 0,
        videoCount: 0,
      });
    });

    it("ranks a channel's videos by views in the range, limited", async () => {
      await apply(count(VIDEO_IDS.a, '2026-03-01', 100), count(VIDEO_IDS.a, DAY, 1));
      await apply(count(VIDEO_IDS.b, DAY, 5), count(VIDEO_IDS.c, DAY, 50));

      expect(expectOk(await views.topVideos(OWNER_ID, WEEK, 5))).toEqual([
        { videoId: VIDEO_IDS.b, title: 'Beta', views: 5, totalViews: 5 },
        { videoId: VIDEO_IDS.a, title: 'Alpha', views: 1, totalViews: 101 },
      ]);
      expect(expectOk(await views.topVideos(OWNER_ID, WEEK, 1))).toHaveLength(1);
    });
  });
}
