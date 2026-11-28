import { expectOk } from '@kit/testing/result';
import { NO_ANCHORS } from '@vp/domain';
import { OWNER_CHANNEL_ID, OWNER_ID, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const LINK_ID = '00000000-0000-7000-8000-0000000000f1';
const GONE_ID = '00000000-0000-7000-8000-0000000000f2';

export function describeContentLinkStatsRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('ContentLinkStatsRepository contract', () => {
    let subject: RepositoriesSubject;

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      expectOk(
        await subject.repositories.contentLinks.insert({
          id: LINK_ID,
          source: { type: 'video', id: VIDEO_IDS.a },
          target: { type: 'video', id: VIDEO_IDS.b },
          params: { relation: 'related' },
          anchors: NO_ANCHORS,
          status: 'active',
          sourceChannelId: OWNER_CHANNEL_ID,
          targetChannelId: OWNER_CHANNEL_ID,
          origin: 'creator',
          createdBy: OWNER_ID,
          decidedBy: null,
          createdAt: new Date('2026-11-01T10:00:00Z'),
        })
      );
    });

    it('adds counts into the same link and day and totals every day', async () => {
      const { contentLinkStats: stats } = subject.repositories;

      expectOk(
        await stats.addDaily([
          { linkId: LINK_ID, day: '2026-11-01', impressions: 10, clicks: 2, watchSeconds: 30 },
          { linkId: LINK_ID, day: '2026-11-01', impressions: 5, clicks: 1, watchSeconds: 0 },
          { linkId: LINK_ID, day: '2026-11-02', impressions: 1, clicks: 0, watchSeconds: 12 },
        ])
      );
      expectOk(
        await stats.addDaily([
          { linkId: LINK_ID, day: '2026-11-02', impressions: 1, clicks: 1, watchSeconds: 8 },
        ])
      );

      expect(expectOk(await stats.totalsFor([LINK_ID])).get(LINK_ID)).toEqual({
        impressions: 17,
        clicks: 4,
        watchSeconds: 50,
      });
    });

    it('answers zero for a link nobody saw and drops counts for a link that is gone', async () => {
      const { contentLinkStats: stats } = subject.repositories;

      expectOk(
        await stats.addDaily([
          { linkId: GONE_ID, day: '2026-11-01', impressions: 3, clicks: 3, watchSeconds: 3 },
        ])
      );

      const totals = expectOk(await stats.totalsFor([LINK_ID, GONE_ID]));
      const none = { impressions: 0, clicks: 0, watchSeconds: 0 };
      expect([...totals]).toEqual([
        [LINK_ID, none],
        [GONE_ID, none],
      ]);
    });
  });
}
