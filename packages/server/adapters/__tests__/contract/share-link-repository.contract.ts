import { expectOk } from '@kit/testing/result';
import type { ShareLinkRepository } from '@vp/core/repositories';
import { NO_SHARE_LINK_TOTALS, type ShareLink } from '@vp/domain';
import { linkId, shareLink } from './access-fixtures';
import { OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

export function describeShareLinkRepositoryContract(makeSubject: MakeRepositoriesSubject): void {
  describe('ShareLinkRepository contract', () => {
    let subject: RepositoriesSubject;
    let links: ShareLinkRepository;

    const create = async (link: ShareLink, limit = 50) => expectOk(await links.create(link, limit));
    const list = async (targetId: string = VIDEO_IDS.a) =>
      expectOk(await links.listFor('video', targetId));

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
      await subject.seedVideo(publicVideo({ id: VIDEO_IDS.b }));
      links = subject.repositories.shareLinks;
    });

    it('lists the links of a target newest first, each read back whole', async () => {
      const expiring = shareLink(2, { expiresAt: new Date('2026-04-01T00:00:00.000Z') });
      const labelled = shareLink(1, { label: null, createdBy: OWNER_ID });
      await create(labelled);
      await create(expiring);
      await create(shareLink(3, { targetId: VIDEO_IDS.b }));

      expect(await list()).toEqual([expiring, labelled]);
      expect(await list(VIDEO_IDS.b)).toEqual([shareLink(3, { targetId: VIDEO_IDS.b })]);
    });

    it('refuses a link once the target holds the limit of active ones, and says so', async () => {
      await create(shareLink(1), 2);
      await create(shareLink(2), 2);

      expect(await create(shareLink(3), 2)).toBe(false);
      expect(await list()).toHaveLength(2);
      expect(await create(shareLink(4, { targetId: VIDEO_IDS.b }), 2)).toBe(true);
    });

    it('counts neither a revoked link nor one expired when the new link is made', async () => {
      await create(shareLink(1, { expiresAt: new Date(shareLink(3).createdAt.getTime() - 1) }), 2);
      await create(shareLink(2, { revokedAt: new Date('2026-03-01T12:00:09.000Z') }), 2);

      expect(await create(shareLink(3), 2)).toBe(true);
      expect(await create(shareLink(4), 2)).toBe(true);
      expect(await create(shareLink(5), 2)).toBe(false);
    });

    it('finds a link by its token or id, and answers null for one nobody holds', async () => {
      await create(shareLink(1));

      expect(expectOk(await links.findByToken(shareLink(1).token))).toEqual(shareLink(1));
      expect(expectOk(await links.findByToken(shareLink(2).token))).toBeNull();
      expect(expectOk(await links.findById(linkId(1)))).toEqual(shareLink(1));
      expect(expectOk(await links.findById(linkId(2)))).toBeNull();
    });

    it('revokes a link of its own target, keeps the first time on a second revoke, and leaves other targets alone', async () => {
      const first = new Date('2026-03-02T00:00:00.000Z');
      await create(shareLink(1));

      expect(expectOk(await links.revoke('video', VIDEO_IDS.b, linkId(1), first))).toBeNull();
      expect(expectOk(await links.revoke('video', VIDEO_IDS.a, linkId(9), first))).toBeNull();
      expect(expectOk(await links.revoke('video', VIDEO_IDS.a, linkId(1), first))).toEqual(
        shareLink(1, { revokedAt: first })
      );
      expect(
        expectOk(
          await links.revoke('video', VIDEO_IDS.a, linkId(1), new Date('2026-03-03T00:00:00.000Z'))
        )
      ).toEqual(shareLink(1, { revokedAt: first }));
      expect(await list()).toEqual([shareLink(1, { revokedAt: first })]);
    });

    it('gives every id a zero total until a flush adds numbers to it', async () => {
      await create(shareLink(1));

      expect(expectOk(await links.totalsFor([linkId(1), linkId(2)]))).toEqual(
        new Map([
          [linkId(1), NO_SHARE_LINK_TOTALS],
          [linkId(2), NO_SHARE_LINK_TOTALS],
        ])
      );
      expect(expectOk(await links.totalsFor([]))).toEqual(new Map());
    });
  });
}
