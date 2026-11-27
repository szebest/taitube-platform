import { expectOk } from '@kit/testing/result';
import type { NewUnpublishedPostInput } from '@vp/domain';
import { NOTIFY_POST_SUBSCRIBERS } from '@vp/job-contracts';
import {
  type ChannelPostContractContext,
  POST_AT,
  POST_IDS,
  auditActions,
  enqueuedJobs,
  postAudit,
  postInput,
  publishPost,
} from './channel-post-contract-context';
import { OTHER_OWNER_CHANNEL_ID, OWNER_CHANNEL_ID } from './fixtures';

const DAY_MS = 86_400_000;

function unpublished(
  id: string,
  over: Partial<NewUnpublishedPostInput> = {}
): NewUnpublishedPostInput {
  return { ...postInput(id), status: 'draft', publishAt: null, ...over };
}

export function describeChannelPostLifecycleContract(ctx: ChannelPostContractContext): void {
  describe('channel post lifecycle', () => {
    const save = async (id: string, over: Partial<NewUnpublishedPostInput> = {}) =>
      expectOk(
        await ctx.posts.saveUnpublished(unpublished(id, over), postAudit('post.updated', id))
      );

    it('saves a draft and a scheduled post without announcing either', async () => {
      const at = new Date(Date.now() + DAY_MS);

      const draft = await save(POST_IDS.a);
      const scheduled = await save(POST_IDS.b, { status: 'scheduled', publishAt: at });

      expect(draft).toMatchObject({
        status: 'draft',
        publishAt: null,
        publishedAt: null,
        version: 1,
      });
      expect(scheduled).toMatchObject({ status: 'scheduled', publishedAt: null });
      expect(scheduled.publishAt?.getTime()).toBe(at.getTime());
      expect(await enqueuedJobs(ctx)).toEqual([]);
    });

    it('counts the drafts and scheduled posts of the channel, never the published or another channel', async () => {
      await save(POST_IDS.a);
      await save(POST_IDS.b, { status: 'scheduled', publishAt: new Date(Date.now() + DAY_MS) });
      await publishPost(ctx, POST_IDS.c);
      expectOk(
        await ctx.posts.saveUnpublished(
          {
            ...postInput(POST_IDS.other, OTHER_OWNER_CHANNEL_ID),
            status: 'draft',
            publishAt: null,
          },
          postAudit('post.updated', POST_IDS.other, OTHER_OWNER_CHANNEL_ID)
        )
      );

      expect(expectOk(await ctx.posts.countPending(OWNER_CHANNEL_ID))).toBe(2);
    });

    it('promotes a draft once: published now, one subscriber job, a second call answers null', async () => {
      await save(POST_IDS.a);

      const promoted = expectOk(
        await ctx.posts.promote(POST_IDS.a, postAudit('post.published', POST_IDS.a))
      );
      const again = expectOk(
        await ctx.posts.promote(POST_IDS.a, postAudit('post.published', POST_IDS.a))
      );

      expect(promoted).toMatchObject({ status: 'published', publishAt: null });
      expect(promoted?.publishedAt).toBeInstanceOf(Date);
      expect(again).toBeNull();
      expect((await enqueuedJobs(ctx)).map((job) => [job.name, job.data])).toEqual([
        [NOTIFY_POST_SUBSCRIBERS, { postId: POST_IDS.a }],
      ]);
      expect(
        (await auditActions(ctx)).filter((entry) => entry === `post.published:${POST_IDS.a}`)
      ).toHaveLength(1);
    });

    it('answers null when promoting a published or a missing post', async () => {
      await publishPost(ctx, POST_IDS.a);

      expect(expectOk(await ctx.posts.promote(POST_IDS.a, null))).toBeNull();
      expect(expectOk(await ctx.posts.promote(POST_IDS.missing, null))).toBeNull();
    });

    it('promotes only the due scheduled posts, oldest first, and twice publishes once', async () => {
      const now = new Date();
      await save(POST_IDS.a, { status: 'scheduled', publishAt: new Date(now.getTime() + 1000) });
      await save(POST_IDS.b, { status: 'scheduled', publishAt: new Date(now.getTime() + DAY_MS) });
      await save(POST_IDS.c, { status: 'scheduled', publishAt: new Date(now.getTime() + 2000) });
      await save(POST_IDS.draft);
      const later = new Date(now.getTime() + 10_000);

      const first = expectOk(await ctx.posts.promoteDue(later, 10));
      const second = expectOk(await ctx.posts.promoteDue(later, 10));

      expect(first).toEqual([POST_IDS.a, POST_IDS.c]);
      expect(second).toEqual([]);
      expect((await enqueuedJobs(ctx)).map((job) => job.data)).toEqual([
        { postId: POST_IDS.a },
        { postId: POST_IDS.c },
      ]);
      expect(expectOk(await ctx.posts.findById(POST_IDS.b))).toMatchObject({ status: 'scheduled' });
    });

    it('stops at the limit and leaves the rest for the next run', async () => {
      const due = new Date(Date.now() + 1000);
      await save(POST_IDS.a, { status: 'scheduled', publishAt: due });
      await save(POST_IDS.b, { status: 'scheduled', publishAt: due });

      const first = expectOk(await ctx.posts.promoteDue(new Date(Date.now() + 5000), 1));
      const second = expectOk(await ctx.posts.promoteDue(new Date(Date.now() + 5000), 1));

      expect([first.length, second.length]).toEqual([1, 1]);
      expect(new Set([...first, ...second]).size).toBe(2);
    });

    it('moves a draft to a schedule through an edit placement', async () => {
      await save(POST_IDS.a);
      const at = new Date(Date.now() + DAY_MS);

      const edited = expectOk(
        await ctx.posts.edit(
          POST_IDS.a,
          1,
          {
            payload: { kind: 'text', text: 'Edited' },
            commentsEnabled: true,
            placement: { status: 'scheduled', publishAt: at },
          },
          postAudit('post.updated', POST_IDS.a)
        )
      );

      expect(edited).toMatchObject({ type: 'edited', post: { status: 'scheduled' } });
    });

    it('lists every status newest created first, filters by status and pages by cursor', async () => {
      await publishPost(ctx, POST_IDS.a);
      await save(POST_IDS.b);
      await save(POST_IDS.c, { status: 'scheduled', publishAt: new Date(Date.now() + DAY_MS) });
      await ctx.subject.backdatePost(POST_IDS.a, POST_AT.old);
      await ctx.subject.backdatePost(POST_IDS.b, POST_AT.mid);
      await ctx.subject.backdatePost(POST_IDS.c, POST_AT.new);

      const all = expectOk(
        await ctx.posts.listManaged(OWNER_CHANNEL_ID, { status: null, cursor: null, limit: 2 })
      );
      const drafts = expectOk(
        await ctx.posts.listManaged(OWNER_CHANNEL_ID, { status: 'draft', cursor: null, limit: 5 })
      );
      const rest = expectOk(
        await ctx.posts.listManaged(OWNER_CHANNEL_ID, {
          status: null,
          cursor: { createdAt: POST_AT.mid, id: POST_IDS.b },
          limit: 5,
        })
      );

      expect(all.map((post) => post.id)).toEqual([POST_IDS.c, POST_IDS.b, POST_IDS.a]);
      expect(drafts.map((post) => post.id)).toEqual([POST_IDS.b]);
      expect(rest.map((post) => post.id)).toEqual([POST_IDS.a]);
    });

    it.each([
      { name: 'a published post', id: POST_IDS.a, pinned: true, expected: 'pinned' },
      { name: 'an unpinned published post', id: POST_IDS.a, pinned: false, expected: 'unpinned' },
      { name: 'a draft', id: POST_IDS.draft, pinned: true, expected: 'not_published' },
      { name: 'a missing post', id: POST_IDS.missing, pinned: true, expected: 'missing' },
    ])('answers $expected when pinning $name', async ({ id, pinned, expected }) => {
      await publishPost(ctx, POST_IDS.a);
      await save(POST_IDS.draft);

      const outcome = expectOk(
        await ctx.posts.setPinned(id, OWNER_CHANNEL_ID, pinned, 3, postAudit('post.updated', id))
      );

      expect(outcome).toBe(expected);
    });

    it('refuses a pin past the limit, and a post of another channel is missing', async () => {
      await publishPost(ctx, POST_IDS.a);
      await publishPost(ctx, POST_IDS.b);
      await publishPost(ctx, POST_IDS.c);
      const pin = async (id: string, channelId = OWNER_CHANNEL_ID, limit = 2) =>
        expectOk(
          await ctx.posts.setPinned(id, channelId, true, limit, postAudit('post.updated', id))
        );

      expect(await pin(POST_IDS.a)).toBe('pinned');
      expect(await pin(POST_IDS.b)).toBe('pinned');
      expect(await pin(POST_IDS.c)).toBe('limit');
      expect(await pin(POST_IDS.a)).toBe('pinned');
      expect(await pin(POST_IDS.c, OTHER_OWNER_CHANNEL_ID)).toBe('missing');
      expect(expectOk(await ctx.posts.findById(POST_IDS.c))?.pinnedAt).toBeNull();
    });
  });
}
