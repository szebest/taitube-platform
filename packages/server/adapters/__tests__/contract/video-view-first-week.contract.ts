import { randomUUID } from 'node:crypto';
import type { VideoViewRepositoryPort } from '@vp/core/repositories';
import type { ViewCount } from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const READY = new Date('2026-03-10T23:30:00.000Z');
const LIMIT = new Date('2026-03-20T00:00:00.000Z');

function count(videoId: string, viewDate: string, views: number): ViewCount {
  return { videoId, viewDate, views, watchSeconds: 0 };
}

export function describeVideoViewFirstWeekContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoViewRepository first week contract', () => {
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
    });

    const seed = (id: string, readyAt: Date | null, overrides = {}) =>
      subject.seedVideo(publicVideo({ id, readyAt, ...overrides }));

    const apply = async (...counts: ViewCount[]) =>
      expectOk(
        await views.applyBatch({
          batchId: randomUUID(),
          counts,
          retention: [],
          hourly: [],
          devices: [],
        })
      );

    describe('firstWeekViews', () => {
      it('sums the views of each UTC day offset from the day the video became ready', async () => {
        await seed(VIDEO_IDS.a, READY);
        await apply(
          count(VIDEO_IDS.a, '2026-03-10', 4),
          count(VIDEO_IDS.a, '2026-03-11', 2),
          count(VIDEO_IDS.a, '2026-03-16', 1)
        );

        expect(expectOk(await views.firstWeekViews([VIDEO_IDS.a]))).toEqual(
          expect.arrayContaining([
            { videoId: VIDEO_IDS.a, dayOffset: 0, views: 4 },
            { videoId: VIDEO_IDS.a, dayOffset: 1, views: 2 },
            { videoId: VIDEO_IDS.a, dayOffset: 6, views: 1 },
          ])
        );
      });

      it('leaves out days before the ready day and from the eighth day on', async () => {
        await seed(VIDEO_IDS.a, READY);
        await apply(
          count(VIDEO_IDS.a, '2026-03-09', 5),
          count(VIDEO_IDS.a, '2026-03-17', 7),
          count(VIDEO_IDS.a, '2026-03-10', 1)
        );

        expect(expectOk(await views.firstWeekViews([VIDEO_IDS.a]))).toEqual([
          { videoId: VIDEO_IDS.a, dayOffset: 0, views: 1 },
        ]);
      });

      it('reads each requested video alone, and nothing for a video that is not ready', async () => {
        await seed(VIDEO_IDS.a, READY);
        await seed(VIDEO_IDS.b, READY);
        await seed(VIDEO_IDS.c, null);
        await apply(
          count(VIDEO_IDS.a, '2026-03-10', 1),
          count(VIDEO_IDS.b, '2026-03-10', 2),
          count(VIDEO_IDS.c, '2026-03-10', 3)
        );

        expect(expectOk(await views.firstWeekViews([VIDEO_IDS.a, VIDEO_IDS.c]))).toEqual([
          { videoId: VIDEO_IDS.a, dayOffset: 0, views: 1 },
        ]);
        expect(expectOk(await views.firstWeekViews([]))).toEqual([]);
      });
    });

    describe('recentPeers', () => {
      const peers = async (limit = 10) =>
        expectOk(await views.recentPeers(OWNER_ID, VIDEO_IDS.f, LIMIT, limit)).map(
          ({ videoId }) => videoId
        );

      it("lists the owner's public ready videos at or before the limit, newest first, up to the limit", async () => {
        await seed(VIDEO_IDS.a, new Date('2026-03-01T00:00:00.000Z'));
        await seed(VIDEO_IDS.b, new Date('2026-03-05T00:00:00.000Z'));
        await seed(VIDEO_IDS.c, LIMIT);
        await seed(VIDEO_IDS.d, new Date('2026-03-03T00:00:00.000Z'));

        expect(await peers()).toEqual([VIDEO_IDS.c, VIDEO_IDS.b, VIDEO_IDS.d, VIDEO_IDS.a]);
        expect(await peers(2)).toEqual([VIDEO_IDS.c, VIDEO_IDS.b]);
      });

      it('leaves out the video itself, later videos, other owners, private and unfinished videos', async () => {
        await seed(VIDEO_IDS.a, new Date('2026-03-01T00:00:00.000Z'));
        await seed(VIDEO_IDS.f, new Date('2026-03-02T00:00:00.000Z'));
        await seed(VIDEO_IDS.b, new Date('2026-03-25T00:00:00.000Z'));
        await seed(VIDEO_IDS.c, new Date('2026-03-02T00:00:00.000Z'), { ownerId: OTHER_OWNER_ID });
        await seed(VIDEO_IDS.d, new Date('2026-03-02T00:00:00.000Z'), { visibility: 'private' });
        await seed(VIDEO_IDS.e, null);

        expect(await peers()).toEqual([VIDEO_IDS.a]);
      });

      it('returns the ready time with each peer', async () => {
        await seed(VIDEO_IDS.a, new Date('2026-03-01T08:00:00.000Z'));

        expect(expectOk(await views.recentPeers(OWNER_ID, VIDEO_IDS.f, LIMIT, 10))).toEqual([
          { videoId: VIDEO_IDS.a, readyAt: new Date('2026-03-01T08:00:00.000Z') },
        ]);
      });
    });
  });
}
