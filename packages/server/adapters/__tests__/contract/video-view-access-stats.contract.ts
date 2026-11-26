import { randomUUID } from 'node:crypto';
import { expectOk } from '@kit/testing/result';
import { type ExperimentCount, NO_SHARE_LINK_TOTALS, type ShareLinkCount } from '@vp/domain';
import {
  ACCESS_DAY,
  ACCESS_NEXT_DAY,
  experiment,
  experimentId,
  linkId,
  shareLink,
} from './access-fixtures';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';
import { viewBatch } from './view-batch';

function linkCount(n: number, viewDate: string, counts: Partial<ShareLinkCount>): ShareLinkCount {
  return { linkId: linkId(n), viewDate, opens: 0, views: 0, watchSeconds: 0, ...counts };
}

function experimentCount(
  n: number,
  variantId: 'a' | 'b',
  viewDate: string,
  counts: Partial<ExperimentCount>
): ExperimentCount {
  return {
    experimentId: experimentId(n),
    variantId,
    viewDate,
    impressions: 0,
    starts: 0,
    watchSeconds: 0,
    ...counts,
  };
}

export function describeVideoViewAccessStatsContract(makeSubject: MakeRepositoriesSubject): void {
  describe('VideoViewRepository share link and test contract', () => {
    let subject: RepositoriesSubject;

    const apply = async (batch = viewBatch()) =>
      expectOk(await subject.repositories.videoViews.applyBatch(batch));
    const totals = async (...ids: number[]) =>
      expectOk(await subject.repositories.shareLinks.totalsFor(ids.map(linkId)));
    const stats = async (n: number) =>
      expectOk(await subject.repositories.videoExperiments.statsFor([experimentId(n)])).get(
        experimentId(n)
      );

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.a }));
      expectOk(await subject.repositories.shareLinks.create(shareLink(1), 50));
      expectOk(await subject.repositories.videoExperiments.create(experiment(1), OWNER_ID, 5));
    });

    it('adds the numbers of a link to the ones already there, a day at a time', async () => {
      await apply(
        viewBatch({
          shareLinks: [
            linkCount(1, ACCESS_DAY, { opens: 2, views: 1, watchSeconds: 30 }),
            linkCount(1, ACCESS_DAY, { opens: 1, watchSeconds: 5 }),
          ],
        })
      );
      await apply(
        viewBatch({
          shareLinks: [
            linkCount(1, ACCESS_DAY, { opens: 1, views: 2, watchSeconds: 10 }),
            linkCount(1, ACCESS_NEXT_DAY, { opens: 4, views: 1 }),
          ],
        })
      );

      expect(await totals(1, 2)).toEqual(
        new Map([
          [linkId(1), { opens: 8, views: 4, watchSeconds: 45 }],
          [linkId(2), NO_SHARE_LINK_TOTALS],
        ])
      );
    });

    it('adds the numbers of a test variant to the ones already there, a variant and day at a time', async () => {
      await apply(
        viewBatch({
          experiments: [
            experimentCount(1, 'a', ACCESS_DAY, { impressions: 10, starts: 2, watchSeconds: 20 }),
            experimentCount(1, 'a', ACCESS_DAY, { impressions: 5 }),
            experimentCount(1, 'b', ACCESS_DAY, { impressions: 7, starts: 3, watchSeconds: 9 }),
          ],
        })
      );
      await apply(
        viewBatch({
          experiments: [
            experimentCount(1, 'a', ACCESS_DAY, { starts: 1, watchSeconds: 4 }),
            experimentCount(1, 'a', ACCESS_NEXT_DAY, { impressions: 3 }),
          ],
        })
      );

      expect(await stats(1)).toEqual([
        { variantId: 'a', impressions: 15, starts: 3, watchSeconds: 24 },
        { variantId: 'a', impressions: 3, starts: 0, watchSeconds: 0 },
        { variantId: 'b', impressions: 7, starts: 3, watchSeconds: 9 },
      ]);
    });

    it('skips a link or test that is not there and applies the rest of the batch', async () => {
      const outcome = await apply(
        viewBatch({
          counts: [{ videoId: VIDEO_IDS.a, viewDate: ACCESS_DAY, views: 1, watchSeconds: 3 }],
          shareLinks: [
            linkCount(7, ACCESS_DAY, { opens: 9 }),
            linkCount(1, ACCESS_DAY, { opens: 1 }),
          ],
          experiments: [
            experimentCount(7, 'a', ACCESS_DAY, { impressions: 9 }),
            experimentCount(1, 'b', ACCESS_DAY, { impressions: 1 }),
          ],
        })
      );

      expect(outcome).toEqual({ type: 'applied', views: 1 });
      expect((await totals(1, 7)).get(linkId(1))).toEqual({ opens: 1, views: 0, watchSeconds: 0 });
      expect((await totals(7)).get(linkId(7))).toEqual(NO_SHARE_LINK_TOTALS);
      expect(await stats(1)).toEqual([
        { variantId: 'b', impressions: 1, starts: 0, watchSeconds: 0 },
      ]);
      expect(
        expectOk(await subject.repositories.videoExperiments.statsFor([experimentId(7)]))
      ).toEqual(new Map([[experimentId(7), []]]));
    });

    it('applies a batch holding only link and test numbers, once', async () => {
      const batch = viewBatch({
        batchId: randomUUID(),
        shareLinks: [linkCount(1, ACCESS_DAY, { opens: 2 })],
        experiments: [experimentCount(1, 'a', ACCESS_DAY, { impressions: 4 })],
      });

      expect(await apply(batch)).toEqual({ type: 'applied', views: 0 });
      expect(await apply(batch)).toEqual({ type: 'already-applied' });

      expect((await totals(1)).get(linkId(1))).toEqual({ opens: 2, views: 0, watchSeconds: 0 });
      expect(await stats(1)).toEqual([
        { variantId: 'a', impressions: 4, starts: 0, watchSeconds: 0 },
      ]);
    });
  });
}
