import { expectOk } from '@kit/testing/result';
import type { CommentTarget } from '@vp/domain';
import { POST_IDS, postAudit, postInput } from './channel-post-contract-context';
import {
  C,
  type CommentContractContext,
  commentsCount,
  seedComment,
} from './comment-contract-context';
import {
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_CHANNEL_ID,
  VIDEO_IDS,
  videoTarget,
} from './fixtures';

export function describeCommentTargetGoneContract(ctx: CommentContractContext): void {
  describe('a target or a root that is gone', () => {
    const write = (target: CommentTarget, parentId: string | null = null) =>
      ctx.comments.create({
        id: C.reply1,
        target,
        channelId: OWNER_CHANNEL_ID,
        authorId: OTHER_OWNER_ID,
        authorChannelId: OTHER_OWNER_CHANNEL_ID,
        parentId,
        content: 'reply',
      });
    const removeRoot = () => ctx.comments.remove({ id: C.liked, target: videoTarget(VIDEO_IDS.a) });

    it('leaves no live reply under a root removed while the reply was written', async () => {
      await seedComment(ctx, C.liked);

      const [created, removed] = await Promise.all([
        write(videoTarget(VIDEO_IDS.a), C.liked),
        removeRoot(),
      ]);

      expect(expectOk(removed)).toBe(expectOk(created) === null ? 1 : 2);
      expect(expectOk(await ctx.comments.findById(C.reply1))).toBeNull();
      expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(0);
    });

    it('writes nothing for a reply to a removed root', async () => {
      await seedComment(ctx, C.liked);
      expectOk(await removeRoot());

      expect(expectOk(await write(videoTarget(VIDEO_IDS.a), C.liked))).toBeNull();
      expect(await commentsCount(ctx, VIDEO_IDS.a)).toBe(0);
    });

    it.each<{ scenario: string; target: CommentTarget }>([
      { scenario: 'a video', target: { type: 'video', id: VIDEO_IDS.f } },
      { scenario: 'a post', target: { type: 'post', id: POST_IDS.missing } },
    ])('writes nothing for a comment on $scenario that is not there', async ({ target }) => {
      expect(expectOk(await write(target))).toBeNull();
      expect(expectOk(await ctx.comments.findById(C.reply1))).toBeNull();
    });

    it('leaves no comment behind a post deleted while the comment was written', async () => {
      const posts = ctx.subject.repositories.channelPosts;
      expectOk(await posts.publish(postInput(POST_IDS.a), postAudit('post.published', POST_IDS.a)));

      await Promise.all([
        write({ type: 'post', id: POST_IDS.a }),
        posts.remove(POST_IDS.a, postAudit('post.deleted', POST_IDS.a)),
      ]);

      expect(expectOk(await ctx.comments.findById(C.reply1))).toBeNull();
    });
  });
}
