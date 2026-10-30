import type { CommentReportRepositoryPort } from '@vp/core/repositories';
import { expectOk } from '@vp/testing/result';
import { C, type CommentContractContext, seedComment } from './comment-contract-context';
import { idsOf, OTHER_OWNER_ID, OWNER_ID, publicVideo, seedOwners, VIDEO_IDS } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const R = {
  first: '00000000-0000-7000-8000-000000000d01',
  second: '00000000-0000-7000-8000-000000000d02',
  third: '00000000-0000-7000-8000-000000000d03',
} as const;

export function describeCommentReportRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('CommentReportRepository contract', () => {
    let subject: RepositoriesSubject;
    let reports: CommentReportRepositoryPort;
    const ctx: CommentContractContext = {
      get subject() {
        return subject;
      },
      get comments() {
        return subject.repositories.comments;
      },
    };

    beforeAll(async () => {
      subject = await makeSubject();
    });

    afterAll(async () => {
      await subject.close();
    });

    beforeEach(async () => {
      await subject.reset();
      await seedOwners(subject.repositories);
      reports = subject.repositories.commentReports;
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await seedComment(ctx, C.old);
      await seedComment(ctx, C.fresh);
    });

    const report = async (id: string, commentId: string, reporterId = OWNER_ID) =>
      expectOk(
        await reports.create({ id, commentId, reporterId, reason: 'spam', note: 'link farm' })
      );

    it('stores an open report', async () => {
      const created = await report(R.first, C.old);

      expect(created).toMatchObject({
        id: R.first,
        commentId: C.old,
        reporterId: OWNER_ID,
        reason: 'spam',
        note: 'link farm',
        resolvedAt: null,
        resolution: null,
      });
      expect(created?.createdAt).toBeInstanceOf(Date);
      expect(expectOk(await reports.findById(R.first))).toEqual(created);
    });

    it('answers null for a second report by the same reporter and takes one from another', async () => {
      await report(R.first, C.old);

      expect(await report(R.second, C.old)).toBeNull();
      expect(await report(R.third, C.old, OTHER_OWNER_ID)).toMatchObject({ id: R.third });
      expect(expectOk(await reports.findById(R.second))).toBeNull();
    });

    it('lists open reports before resolved ones, each newest first, with the comment', async () => {
      await report(R.first, C.old);
      await report(R.second, C.fresh);
      await report(R.third, C.old, OTHER_OWNER_ID);
      expectOk(await reports.resolve(R.second, 'dismissed'));

      const rows = expectOk(await reports.list({ cursor: null, limit: 10 }));

      expect(idsOf(rows)).toEqual([R.third, R.first, R.second]);
      expect(rows[0]?.comment).toEqual({
        id: C.old,
        videoId: VIDEO_IDS.a,
        authorId: OTHER_OWNER_ID,
        content: 'comment 01',
        removed: false,
      });
    });

    it('resumes after a cursor and flags a removed comment', async () => {
      await report(R.first, C.old);
      await report(R.second, C.fresh);
      expectOk(await subject.repositories.comments.remove({ id: C.old, videoId: VIDEO_IDS.a }));

      const page = expectOk(await reports.list({ cursor: null, limit: 1 }));
      const last = page[0];
      const rest = expectOk(
        await reports.list({
          cursor: last
            ? { open: last.resolvedAt === null, createdAt: last.createdAt, id: last.id }
            : null,
          limit: 5,
        })
      );

      expect(idsOf(page)).toEqual([R.second, R.first]);
      expect(idsOf(rest)).toEqual([R.first]);
      expect(rest[0]?.comment.removed).toBe(true);
    });

    it('resolves a report once', async () => {
      await report(R.first, C.old);

      const resolved = expectOk(await reports.resolve(R.first, 'dismissed'));
      const again = expectOk(await reports.resolve(R.first, 'removed'));

      expect(resolved).toMatchObject({ resolution: 'dismissed' });
      expect(resolved?.resolvedAt).toBeInstanceOf(Date);
      expect(again).toBeNull();
      expect(expectOk(await reports.resolve(R.second, 'removed'))).toBeNull();
    });

    it('closes every open report on a comment and answers the reports it closed', async () => {
      await report(R.first, C.old);
      await report(R.second, C.old, OTHER_OWNER_ID);
      await report(R.third, C.fresh);

      const closed = expectOk(await reports.resolveForComment(C.old, 'removed'));

      expect(idsOf(closed).toSorted()).toEqual([R.first, R.second]);
      expect(closed.map(({ resolution }) => resolution)).toEqual(['removed', 'removed']);
      expect(closed.every(({ resolvedAt }) => resolvedAt instanceof Date)).toBe(true);
      expect(expectOk(await reports.resolveForComment(C.old, 'removed'))).toEqual([]);
      expect(expectOk(await reports.findById(R.first))).toMatchObject({ resolution: 'removed' });
      expect(expectOk(await reports.findById(R.third))).toMatchObject({ resolution: null });
    });
  });
}
