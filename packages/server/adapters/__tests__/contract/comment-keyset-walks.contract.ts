import { expectOk } from '@kit/testing/result';
import type { CommentWindow } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { CommentSort } from '@vp/domain';
import {
  C,
  type CommentContractContext,
  keyset,
  nextWindow,
  seedComment,
} from './comment-contract-context';
import { OWNER_CHANNEL_ID, OWNER_ID, VIDEO_IDS } from './fixtures';
import { SHARED_MILLISECOND, walkByCreatedAt, walkOneAtATime } from './keyset-walk';

const ROOTS = [C.old, C.liked, C.fresh];
const REPLIES = [C.reply1, C.reply2];

export function describeCommentKeysetWalksContract(ctx: CommentContractContext): void {
  describe('walks within one millisecond', () => {
    const seedInOneMillisecond = async (ids: readonly string[], parentId?: string) => {
      for (const id of ids) await seedComment(ctx, id, { parentId });
      await ctx.subject.spreadAcrossMicroseconds({
        stamp: schema.videoComments.createdAt,
        key: schema.videoComments.id,
        ids,
        at: SHARED_MILLISECOND,
      });
    };

    it.each<CommentSort>(['top', 'newest'])('serves every root once under %s', async (sort) => {
      await seedInOneMillisecond(ROOTS);

      const served = await walkOneAtATime(
        async (window: CommentWindow | null) =>
          expectOk(
            await ctx.comments.listThreads(VIDEO_IDS.a, {
              viewer: null,
              sort,
              window: window ?? keyset(1),
            })
          ),
        (row) => nextWindow(row, 1),
        ({ id }) => id
      );

      expect(served.sort()).toEqual([...ROOTS].sort());
    });

    it('serves every reply of a thread once', async () => {
      await seedComment(ctx, C.liked);
      await seedInOneMillisecond(REPLIES, C.liked);
      const root = { id: C.liked, videoId: VIDEO_IDS.a };

      const served = await walkByCreatedAt(async (cursor) =>
        expectOk(await ctx.comments.listReplies(root, { viewer: null, cursor, limit: 1 }))
      );

      expect(served.sort()).toEqual([...REPLIES].sort());
    });

    it('serves every comment of the owner inbox once', async () => {
      await seedInOneMillisecond(ROOTS);

      const served = await walkByCreatedAt(async (cursor) =>
        expectOk(
          await ctx.comments.listForOwner(OWNER_ID, {
            channelId: OWNER_CHANNEL_ID,
            filter: 'all',
            cursor,
            limit: 1,
          })
        )
      );

      expect(served.sort()).toEqual([...ROOTS].sort());
    });

    it('serves every comment of its author once', async () => {
      await seedInOneMillisecond(ROOTS);
      const viewer = { id: ctx.authorId, role: 'USER' as const };

      const served = await walkByCreatedAt(async (cursor) =>
        expectOk(await ctx.comments.listByAuthor(viewer, { cursor, limit: 1 }))
      );

      expect(served.sort()).toEqual([...ROOTS].sort());
    });
  });
}
