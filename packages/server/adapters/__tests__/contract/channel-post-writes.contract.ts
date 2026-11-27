import { expectOk } from '@kit/testing/result';
import { NOTIFY_POST_SUBSCRIBERS } from '@vp/job-contracts';
import {
  type ChannelPostContractContext,
  POST_IDS,
  auditActions,
  enqueuedJobs,
  postAudit,
  postInput,
  publishPost,
} from './channel-post-contract-context';
import {
  HOUR_MS,
  OTHER_OWNER_CHANNEL_ID,
  OTHER_OWNER_ID,
  OWNER_ID,
  OWNER_CHANNEL_ID,
  VIDEO_IDS,
  publicVideo,
  videoTarget,
} from './fixtures';

const NEXT_PAYLOAD = { kind: 'text', text: 'Edited' } as const;
const REVISION = { authorUserId: OWNER_ID, restoredFromVersion: null };
const EDIT = { payload: NEXT_PAYLOAD, commentsEnabled: false, revision: REVISION };

export function describeChannelPostWritesContract(ctx: ChannelPostContractContext): void {
  describe('channel post writes', () => {
    const comment = (id: string, target: ReturnType<typeof videoTarget>) =>
      ctx.subject.repositories.comments.create({
        id,
        target,
        channelId: OWNER_CHANNEL_ID,
        authorId: OTHER_OWNER_ID,
        authorChannelId: OTHER_OWNER_CHANNEL_ID,
        parentId: null,
        content: 'hello',
      });

    it('publishes a post as published now at version 1, with its audit row and subscriber job', async () => {
      const before = Date.now();

      const post = await publishPost(ctx, POST_IDS.a);

      expect(post).toMatchObject({
        id: POST_IDS.a,
        channelId: OWNER_CHANNEL_ID,
        status: 'published',
        version: 1,
        pinnedAt: null,
        editedAt: null,
        likeCount: 0,
        commentsCount: 0,
        commentsEnabled: true,
        payload: { kind: 'text', text: 'Post 1' },
      });
      expect(post.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(await auditActions(ctx)).toEqual([`post.published:${POST_IDS.a}`]);
      expect((await enqueuedJobs(ctx)).map((job) => [job.name, job.data])).toEqual([
        [NOTIFY_POST_SUBSCRIBERS, { postId: POST_IDS.a }],
      ]);
    });

    it('finds a post by id and answers null for one that is not there', async () => {
      const post = await publishPost(ctx, POST_IDS.a);

      expect(expectOk(await ctx.posts.findById(POST_IDS.a))).toEqual(post);
      expect(expectOk(await ctx.posts.findById(POST_IDS.missing))).toBeNull();
    });

    it('counts only the posts of that channel created at or after the instant', async () => {
      const since = new Date(Date.now() - HOUR_MS);
      await publishPost(ctx, POST_IDS.a);
      await publishPost(ctx, POST_IDS.b);
      await publishPost(ctx, POST_IDS.c);
      await publishPost(ctx, POST_IDS.other, OTHER_OWNER_CHANNEL_ID);
      await ctx.subject.backdatePost(POST_IDS.b, since);
      await ctx.subject.backdatePost(POST_IDS.c, new Date(since.getTime() - 1));

      expect(expectOk(await ctx.posts.countCreatedSince(OWNER_CHANNEL_ID, since))).toBe(2);
      expect(expectOk(await ctx.posts.countCreatedSince(OTHER_OWNER_CHANNEL_ID, since))).toBe(1);
    });

    it('counts a draft among the posts created', async () => {
      await ctx.subject.seedDraftPost(postInput(POST_IDS.draft));

      expect(
        expectOk(
          await ctx.posts.countCreatedSince(OWNER_CHANNEL_ID, new Date(Date.now() - HOUR_MS))
        )
      ).toBe(1);
    });

    it('edits at the current version, moving it on and stamping editedAt', async () => {
      await publishPost(ctx, POST_IDS.a);

      const edited = expectOk(
        await ctx.posts.edit(POST_IDS.a, 1, EDIT, postAudit('post.updated', POST_IDS.a))
      );

      expect(edited).toMatchObject({
        type: 'edited',
        post: { id: POST_IDS.a, version: 2, commentsEnabled: false, payload: NEXT_PAYLOAD },
      });
      expect(edited.type === 'edited' && edited.post.editedAt).toBeInstanceOf(Date);
      expect(expectOk(await ctx.posts.findById(POST_IDS.a))).toMatchObject({ version: 2 });
      expect(await auditActions(ctx)).toContain(`post.updated:${POST_IDS.a}`);
    });

    it.each([
      {
        name: 'a stale version',
        id: POST_IDS.a,
        version: 1,
        expected: { type: 'stale', version: 2 },
      },
      {
        name: 'a version ahead',
        id: POST_IDS.a,
        version: 9,
        expected: { type: 'stale', version: 2 },
      },
      { name: 'a missing post', id: POST_IDS.missing, version: 1, expected: { type: 'missing' } },
    ])('reports $name without writing anything', async ({ id, version, expected }) => {
      await publishPost(ctx, POST_IDS.a);
      expectOk(await ctx.posts.edit(POST_IDS.a, 1, EDIT, postAudit('post.updated', POST_IDS.a)));
      const audited = await auditActions(ctx);

      const result = expectOk(
        await ctx.posts.edit(
          id,
          version,
          { ...EDIT, commentsEnabled: true },
          postAudit('post.updated', id)
        )
      );

      expect(result).toEqual(expected);
      expect(await auditActions(ctx)).toEqual(audited);
      expect(expectOk(await ctx.posts.findById(POST_IDS.a))).toMatchObject({
        version: 2,
        commentsEnabled: false,
      });
    });

    it('removes a post once, writing its audit row, and answers false the second time', async () => {
      await publishPost(ctx, POST_IDS.a);

      expect(
        expectOk(await ctx.posts.remove(POST_IDS.a, postAudit('post.deleted', POST_IDS.a)))
      ).toBe(true);
      expect(
        expectOk(await ctx.posts.remove(POST_IDS.a, postAudit('post.deleted', POST_IDS.a)))
      ).toBe(false);

      expect(expectOk(await ctx.posts.findById(POST_IDS.a))).toBeNull();
      expect(
        (await auditActions(ctx)).filter((entry) => entry === `post.deleted:${POST_IDS.a}`)
      ).toHaveLength(1);
    });

    it('takes the comments of the post with it and leaves a video comment alone', async () => {
      const postComment = '00000000-0000-7000-8000-000000000c91';
      const videoComment = '00000000-0000-7000-8000-000000000c92';
      await publishPost(ctx, POST_IDS.a);
      await ctx.subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      expectOk(await comment(postComment, { type: 'post', id: POST_IDS.a }));
      expectOk(await comment(videoComment, videoTarget(VIDEO_IDS.a)));

      expectOk(await ctx.posts.remove(POST_IDS.a, postAudit('post.deleted', POST_IDS.a)));

      const { comments } = ctx.subject.repositories;
      expect(expectOk(await comments.findById(postComment))).toBeNull();
      expect(expectOk(await comments.findById(videoComment))).not.toBeNull();
    });
  });
}
