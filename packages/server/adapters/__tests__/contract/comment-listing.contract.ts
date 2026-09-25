import { expectOk } from '@vp/testing/result';
import {
  C,
  type CommentContractContext,
  commentsCount,
  keyset,
  nextWindow,
  seedComment,
  seedThreads,
} from './comment-contract-context';
import { VIDEO_IDS, idsOf } from './fixtures';

export function describeCommentListingContract(ctx: CommentContractContext): void {
  describe('listing', () => {
    it('ranks roots by likes then recency, carrying each thread reply count', async () => {
      await seedThreads(ctx);

      const top = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, { sort: 'top', window: keyset(10) })
      );

      expect(idsOf(top)).toEqual([C.liked, C.old, C.fresh]);
      expect(top.map((row) => row.replyCount)).toEqual([2, 0, 0]);
    });

    it('ranks roots by recency alone under newest', async () => {
      await seedThreads(ctx);

      const newest = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, { sort: 'newest', window: keyset(10) })
      );

      expect(idsOf(newest)).toEqual([C.fresh, C.liked, C.old]);
    });

    it.each(['top', 'newest'] as const)('puts the pinned comment first under %s', async (sort) => {
      await seedThreads(ctx);
      expectOk(await ctx.comments.setPinned({ id: C.old, videoId: VIDEO_IDS.a }, true));

      const [first] = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, { sort, window: keyset(10) })
      );

      expect(first).toMatchObject({ id: C.old, isPinned: true });
    });

    it.each([
      { sort: 'top' as const, order: [C.old, C.liked, C.fresh] },
      { sort: 'newest' as const, order: [C.old, C.fresh, C.liked] },
    ])('walks every root once from keyset cursors under $sort', async ({ sort, order }) => {
      await seedThreads(ctx);
      expectOk(await ctx.comments.setPinned({ id: C.old, videoId: VIDEO_IDS.a }, true));
      const seen: string[] = [];
      let window = keyset(1);

      for (let page = 0; page < 5; page++) {
        const rows = expectOk(await ctx.comments.listThreads(VIDEO_IDS.a, { sort, window }));
        const [row] = rows;
        if (!row) break;
        seen.push(row.id);
        if (rows.length < 2) break;
        window = nextWindow(row, 1);
      }

      expect(seen).toEqual(order);
    });

    it('serves an offset window for the legacy page query', async () => {
      await seedThreads(ctx);

      const page = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.a, {
          sort: 'top',
          window: { type: 'offset', offset: 1, limit: 1 },
        })
      );

      expect(idsOf(page)).toEqual([C.old, C.fresh]);
    });

    it('keeps each video to its own comments', async () => {
      await seedThreads(ctx);
      await seedComment(ctx, C.other, { videoId: VIDEO_IDS.b });

      const other = expectOk(
        await ctx.comments.listThreads(VIDEO_IDS.b, { sort: 'top', window: keyset(10) })
      );

      expect(idsOf(other)).toEqual([C.other]);
      expect(await commentsCount(ctx, VIDEO_IDS.b)).toBe(1);
    });

    it('lists a thread replies oldest first and resumes from a cursor', async () => {
      await seedThreads(ctx);
      const root = { id: C.liked, videoId: VIDEO_IDS.a };

      const all = expectOk(await ctx.comments.listReplies(root, { cursor: null, limit: 10 }));
      const [first] = all;
      if (!first) throw new Error('the thread has no replies');
      const rest = expectOk(
        await ctx.comments.listReplies(root, {
          cursor: { createdAt: first.createdAt, id: first.id },
          limit: 10,
        })
      );

      expect(idsOf(all)).toEqual([C.reply1, C.reply2]);
      expect(all[0]?.author.handle).toBe('commenter');
      expect(idsOf(rest)).toEqual([C.reply2]);
    });
  });
}
