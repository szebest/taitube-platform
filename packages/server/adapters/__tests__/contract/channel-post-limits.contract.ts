import { expectOk } from '@kit/testing/result';
import type { NewUnpublishedPostInput, PostPayload } from '@vp/domain';
import {
  type ChannelPostContractContext,
  POST_IDS,
  enqueuedJobs,
  postAudit,
  postInput,
  publishPost,
} from './channel-post-contract-context';
import { OTHER_OWNER_ID, OWNER_ID } from './fixtures';

const DAY_MS = 86_400_000;

export function describeChannelPostLimitsContract(ctx: ChannelPostContractContext): void {
  const save = async (id: string) =>
    expectOk(
      await ctx.posts.saveUnpublished(
        { ...postInput(id), status: 'draft', publishAt: null } satisfies NewUnpublishedPostInput,
        postAudit('post.updated', id)
      )
    );

  describe('channel post limits, poll locks and revisions', () => {
    const AUTHOR = { authorUserId: OWNER_ID, restoredFromVersion: null };
    const LIMITS = { dailySince: new Date(Date.now() - DAY_MS), daily: 3, pending: 2 };
    const poll = (question: string, options: string[]) =>
      ({ kind: 'poll', question, options, closesAt: null }) as const;
    const create = async (id: string, status: 'published' | 'draft', limits = LIMITS) =>
      expectOk(
        await ctx.posts.create(
          { ...postInput(id), status, publishAt: null },
          postAudit('post.published', id),
          limits
        )
      );

    it('counts the day and the held posts when it adds one, and announces only a published one', async () => {
      expect((await create(POST_IDS.a, 'draft')).type).toBe('created');
      expect((await create(POST_IDS.b, 'draft')).type).toBe('created');
      expect((await create(POST_IDS.c, 'draft')).type).toBe('pending_limit');
      expect((await create(POST_IDS.c, 'published')).type).toBe('created');
      expect((await create(POST_IDS.other, 'published')).type).toBe('daily_limit');
      expect((await enqueuedJobs(ctx)).map((job) => job.data)).toEqual([{ postId: POST_IDS.c }]);
    });

    it('lets only as many concurrent adds through as the day holds', async () => {
      const results = await Promise.all(
        [POST_IDS.a, POST_IDS.b, POST_IDS.c, POST_IDS.other].map((id) =>
          ctx.posts.create(
            { ...postInput(id), status: 'published', publishAt: null },
            postAudit('post.published', id),
            { ...LIMITS, daily: 2 }
          )
        )
      );

      expect(results.map((result) => expectOk(result).type).sort()).toEqual([
        'created',
        'created',
        'daily_limit',
        'daily_limit',
      ]);
    });

    it('moves the version when a draft is promoted, so an edit made before it is stale', async () => {
      await save(POST_IDS.a);

      const promoted = expectOk(await ctx.posts.promote(POST_IDS.a, null));
      const late = expectOk(
        await ctx.posts.edit(
          POST_IDS.a,
          1,
          {
            payload: { kind: 'text', text: 'late' },
            commentsEnabled: true,
            placement: { status: 'draft', publishAt: null },
            revision: AUTHOR,
          },
          postAudit('post.updated', POST_IDS.a)
        )
      );

      expect(promoted?.version).toBe(2);
      expect(late).toEqual({ type: 'stale', version: 2 });
      expect(expectOk(await ctx.posts.findById(POST_IDS.a))).toMatchObject({
        status: 'published',
      });
    });

    it('keeps the options of a poll once a vote is in and lets its close time move', async () => {
      const base = poll('Q?', ['a', 'b']);
      expectOk(
        await ctx.posts.publish(
          { ...postInput(POST_IDS.a), payload: base },
          postAudit('post.published', POST_IDS.a)
        )
      );
      const edit = async (version: number, payload: PostPayload) =>
        expectOk(
          await ctx.posts.edit(
            POST_IDS.a,
            version,
            { payload, commentsEnabled: true, revision: AUTHOR },
            postAudit('post.updated', POST_IDS.a)
          )
        );
      expect((await edit(1, poll('Q?', ['a', 'b', 'c']))).type).toBe('edited');
      expectOk(await ctx.subject.repositories.postEngagement.vote(POST_IDS.a, OTHER_OWNER_ID, 0));

      const reworded = await edit(2, poll('Q?', ['a', 'x', 'c']));
      const closing = await edit(2, {
        ...poll('Q?', ['a', 'b', 'c']),
        closesAt: '2030-01-01T00:00:00.000Z',
      });

      expect(reworded).toEqual({ type: 'locked' });
      expect(closing.type).toBe('edited');
    });

    it('records the state before the first edit and each edit after it, for a published post only', async () => {
      await publishPost(ctx, POST_IDS.a);
      await save(POST_IDS.b);
      const edit = async (
        id: string,
        version: number,
        text: string,
        restoredFromVersion: number | null
      ) =>
        expectOk(
          await ctx.posts.edit(
            id,
            version,
            {
              payload: { kind: 'text', text },
              commentsEnabled: true,
              revision: { authorUserId: OWNER_ID, restoredFromVersion },
            },
            postAudit('post.updated', id)
          )
        );
      await edit(POST_IDS.a, 1, 'one', null);
      await edit(POST_IDS.a, 2, 'two', 1);
      await edit(POST_IDS.b, 1, 'draft edit', null);
      const { entityRevisions } = ctx.subject.repositories;

      const history = expectOk(
        await entityRevisions.list('channel_post', POST_IDS.a, { beforeVersion: null, limit: 10 })
      );
      const ofDraft = expectOk(
        await entityRevisions.list('channel_post', POST_IDS.b, { beforeVersion: null, limit: 10 })
      );

      expect(
        history.map((row) => [
          row.version,
          row.snapshot.payload,
          row.authorUserId,
          row.restoredFromVersion,
        ])
      ).toEqual([
        [3, { kind: 'text', text: 'two' }, OWNER_ID, 1],
        [2, { kind: 'text', text: 'one' }, OWNER_ID, null],
        [1, { kind: 'text', text: 'Post 1' }, null, null],
      ]);
      expect(ofDraft).toEqual([]);
    });
  });
}
