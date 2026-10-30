import type { AuthoredComment } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { C, type CommentContractContext, seedComment } from './comment-contract-context';
import { OTHER_OWNER_ID, OWNER_ID, publicVideo, VIDEO_IDS } from './fixtures';

const VIEWER: UserContext = { id: OTHER_OWNER_ID, role: 'USER' };
const HIDDEN_ID = '00000000-0000-7000-8000-0000000000f7';
const DELETED_ID = '00000000-0000-7000-8000-0000000000f8';
const STRANGER_COMMENT = '00000000-0000-7000-8000-000000000c0f';

const idsOf = (rows: readonly AuthoredComment[]) => rows.map((row) => row.id);

export function describeAuthoredCommentsContract(ctx: CommentContractContext): void {
  describe('the viewer own comments', () => {
    const authored = async (limit = 10) =>
      expectOk(await ctx.comments.listByAuthor(VIEWER, { cursor: null, limit }));

    it('lists comments and replies newest first with the video, and walks on from a cursor', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 3, likes: 4 });
      await seedComment(ctx, C.reply1, { parentId: C.old, hoursAgo: 2 });
      await seedComment(ctx, C.fresh, { hoursAgo: 1, videoId: VIDEO_IDS.b });

      const first = await authored(2);
      const last = first[1];
      const rest = last
        ? expectOk(
            await ctx.comments.listByAuthor(VIEWER, {
              cursor: { createdAt: last.createdAt, id: last.id },
              limit: 5,
            })
          )
        : [];

      expect(idsOf(first)).toEqual([C.fresh, C.reply1, C.old]);
      expect(first[0]).toMatchObject({
        content: 'comment 03',
        parentId: null,
        likeCount: 0,
        video: { id: VIDEO_IDS.b, title: `Video ${VIDEO_IDS.b.slice(-1)}` },
      });
      expect(first[1]?.parentId).toBe(C.old);
      expect(idsOf(rest)).toEqual([C.old]);
      expect(rest[0]?.likeCount).toBe(4);
    });

    it('lists the caller comments only, and none that were removed', async () => {
      await seedComment(ctx, C.old, { hoursAgo: 3 });
      await seedComment(ctx, C.fresh, { hoursAgo: 1 });
      expectOk(
        await ctx.comments.create({
          id: STRANGER_COMMENT,
          videoId: VIDEO_IDS.a,
          authorId: OWNER_ID,
          parentId: null,
          content: 'not mine',
        })
      );
      expectOk(await ctx.comments.remove({ id: C.fresh, videoId: VIDEO_IDS.a }));

      expect(idsOf(await authored())).toEqual([C.old]);
    });

    it('drops a comment on a video the viewer may not read, or that was deleted', async () => {
      await ctx.subject.repositories.videos.create(
        publicVideo({ id: HIDDEN_ID, visibility: 'private' })
      );
      await ctx.subject.repositories.videos.create(
        publicVideo({ id: DELETED_ID, status: 'DELETED' })
      );
      await seedComment(ctx, C.old, { hoursAgo: 3 });
      await seedComment(ctx, C.liked, { hoursAgo: 2, videoId: HIDDEN_ID });
      await seedComment(ctx, C.fresh, { hoursAgo: 1, videoId: DELETED_ID });

      expect(idsOf(await authored())).toEqual([C.old]);
    });
  });
}
