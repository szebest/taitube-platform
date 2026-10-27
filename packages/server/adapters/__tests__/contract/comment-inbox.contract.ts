import { expectOk } from '@vp/testing/result';
import { C, type CommentContractContext, seedComment } from './comment-contract-context';
import { idsOf, OTHER_OWNER_ID, OWNER_ID, publicVideo, VIDEO_IDS } from './fixtures';

const REPORT_ID = '00000000-0000-7000-8000-000000000d01';
const OWNER_REPLY_ID = '00000000-0000-7000-8000-000000000c0a';

export function describeCommentInboxContract(ctx: CommentContractContext): void {
  const inbox = async (filter: 'all' | 'unanswered' | 'reported' = 'all', limit = 10) =>
    expectOk(await ctx.comments.listForOwner(OWNER_ID, { filter, cursor: null, limit }));

  async function ownerReplies(parentId: string, hoursAgo: number): Promise<void> {
    expectOk(
      await ctx.comments.create({
        id: OWNER_REPLY_ID,
        videoId: VIDEO_IDS.a,
        authorId: OWNER_ID,
        parentId,
        content: 'thanks',
      })
    );
    await ctx.subject.adjustComment(OWNER_REPLY_ID, {
      createdAt: new Date(Date.parse('2026-03-01T12:00:00.000Z') - hoursAgo * 3_600_000),
      likeCount: 0,
    });
  }

  describe('hearts', () => {
    beforeEach(() => seedComment(ctx, C.old));

    const setHearted = async (hearted: boolean, videoId: string = VIDEO_IDS.a) =>
      expectOk(await ctx.comments.setHearted({ id: C.old, videoId }, hearted));

    it('hearts a comment, keeps the first instant when hearted again, and takes it back', async () => {
      const first = await setHearted(true);
      const again = await setHearted(true);
      const removed = await setHearted(false);

      expect(first?.heartedAt).toBeInstanceOf(Date);
      expect(again?.heartedAt).toEqual(first?.heartedAt);
      expect(removed?.heartedAt).toBeNull();
    });

    it('shows the heart in the listing', async () => {
      await setHearted(true);

      const [thread] = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, {
          sort: 'top',
          window: { type: 'keyset', cursor: null, limit: 5 },
        })
      );

      expect(thread?.heartedAt).toBeInstanceOf(Date);
    });

    it('answers null for a comment under another video or one that was removed', async () => {
      expect(await setHearted(true, VIDEO_IDS.b)).toBeNull();

      expectOk(await ctx.comments.remove({ id: C.old, videoId: VIDEO_IDS.a }));

      expect(await setHearted(true)).toBeNull();
    });
  });

  describe('the creator inbox', () => {
    beforeEach(async () => {
      await ctx.subject.repositories.videos.create(
        publicVideo({ id: VIDEO_IDS.c, ownerId: OTHER_OWNER_ID })
      );
    });

    it('lists comments on the owner videos newest first with the video, and nothing else', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 3 });
      await seedComment(ctx, C.fresh, { hoursAgo: 1, videoId: VIDEO_IDS.b });
      await seedComment(ctx, C.other, { videoId: VIDEO_IDS.c });
      await ownerReplies(C.old, 2);

      const rows = await inbox();

      expect(idsOf(rows)).toEqual([C.fresh, C.old]);
      expect(rows[0]).toMatchObject({
        video: { id: VIDEO_IDS.b, title: 'Video b' },
        author: { userId: OTHER_OWNER_ID },
        heartedAt: null,
      });
    });

    it('leaves out the comments of a removed video and of a removed comment', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 3 });
      await seedComment(ctx, C.fresh, { hoursAgo: 1, videoId: VIDEO_IDS.b });
      expectOk(await ctx.comments.remove({ id: C.old, videoId: VIDEO_IDS.a }));

      expect(idsOf(await inbox())).toEqual([C.fresh]);
    });

    it('hands back one row past the limit and resumes after a cursor', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 3 });
      await seedComment(ctx, C.liked, { hoursAgo: 2 });
      await seedComment(ctx, C.fresh, { hoursAgo: 1 });

      const page = await inbox('all', 2);
      const last = page[1];
      const rest = expectOk(
        await ctx.comments.listForOwner(OWNER_ID, {
          filter: 'all',
          cursor: last ? { createdAt: last.createdAt, id: last.id } : null,
          limit: 2,
        })
      );

      expect(idsOf(page)).toEqual([C.fresh, C.liked, C.old]);
      expect(idsOf(rest)).toEqual([C.old]);
    });

    it('keeps under unanswered what the owner has not replied to after it, replies included', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 4 });
      await seedComment(ctx, C.fresh, { hoursAgo: 3 });
      await ownerReplies(C.old, 2);
      await seedComment(ctx, C.reply1, { parentId: C.old, hoursAgo: 1 });

      const rows = await inbox('unanswered');

      expect(idsOf(rows)).toEqual([C.reply1, C.fresh]);
    });

    it('keeps under reported what has an open report, until it is resolved', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 3 });
      await seedComment(ctx, C.fresh, { hoursAgo: 1 });
      expectOk(
        await ctx.subject.repositories.commentReports.create({
          id: REPORT_ID,
          commentId: C.old,
          reporterId: OWNER_ID,
          reason: 'spam',
          note: null,
        })
      );

      expect(idsOf(await inbox('reported'))).toEqual([C.old]);

      expectOk(await ctx.subject.repositories.commentReports.resolve(REPORT_ID, 'dismissed'));

      expect(await inbox('reported')).toEqual([]);
    });
  });

  describe('announcing a new comment', () => {
    const events = async () =>
      expectOk(await ctx.subject.repositories.userEvents.listFrom(OWNER_ID, 1, 10));

    it('tells the video owner, once per comment by someone else', async () => {
      await seedComment(ctx, C.old);

      const [event, ...rest] = await events();

      expect(rest).toEqual([]);
      expect(event).toMatchObject({
        type: 'comment.created',
        payload: {
          comment: { id: C.old, parentId: null, author: { userId: OTHER_OWNER_ID } },
          video: { id: VIDEO_IDS.a, title: 'Video a' },
        },
      });
    });

    it('does not tell the owner about their own comment', async () => {
      expectOk(
        await ctx.comments.create({
          id: C.old,
          videoId: VIDEO_IDS.a,
          authorId: OWNER_ID,
          parentId: null,
          content: 'mine',
        })
      );

      expect(await events()).toEqual([]);
    });
  });
}
