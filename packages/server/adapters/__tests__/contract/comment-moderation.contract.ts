import type { CommentModerationWrite } from '@vp/core/repositories';
import {
  type CommentModerationAction,
  type Disclosure,
  type ModerationState,
  commentModerationAudit,
} from '@vp/domain';
import { expectOk } from '@vp/testing/result';
import {
  C,
  type CommentContractContext,
  commentsCount,
  seedComment,
  seedThreads,
} from './comment-contract-context';
import { OTHER_OWNER_ID, OWNER_ID, VIDEO_IDS, publicVideo, seedOwners } from './fixtures';
import type { MakeRepositoriesSubject, RepositoriesSubject } from './subjects';

const DAY_MS = 86_400_000;

const outcome = (
  state: ModerationState,
  disclosure: Disclosure | null = null,
  reason: 'spam' | null = null
) => ({ state, disclosure, reason, note: null });

const HELD_AT_CREATION = {
  moderationState: 'held',
  moderationDisclosure: 'visible',
  heldReason: 'review_all',
  looksLikeQuestion: false,
} as const;

export function describeCommentModerationRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describe('CommentModerationRepository contract', () => {
    let subject: RepositoriesSubject;
    let channelId: string;
    const ctx: CommentContractContext = {
      get subject() {
        return subject;
      },
      get comments() {
        return subject.repositories.comments;
      },
      authorId: OTHER_OWNER_ID,
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
      await subject.repositories.videos.create(publicVideo({ id: VIDEO_IDS.a }));
      await subject.repositories.channels.create({
        userId: OTHER_OWNER_ID,
        handle: 'commenter',
        displayName: 'The Commenter',
      });
      const channel = expectOk(
        await ctx.subject.repositories.channels.create({
          userId: OWNER_ID,
          handle: 'video-owner',
          displayName: 'Video Owner',
        })
      );
      channelId = channel.id;
    });

    const target = (id: string) => ({ id, videoId: VIDEO_IDS.a });
    const audit = (action: CommentModerationAction['action'], id: string, disclosure: Disclosure) =>
      commentModerationAudit({
        channelId,
        actorUserId: OWNER_ID,
        action,
        commentId: id,
        videoId: VIDEO_IDS.a,
        disclosure,
      });
    const moderate = async (
      id: string,
      action: CommentModerationAction['action'],
      from: ModerationState,
      to: ReturnType<typeof outcome> & { state: ModerationState }
    ) =>
      expectOk(
        await ctx.subject.repositories.commentModeration.moderate({
          comment: target(id),
          from,
          outcome: to,
          moderatorId: OWNER_ID,
          audit: audit(action, id, to.disclosure ?? 'silent'),
        } satisfies CommentModerationWrite)
      );
    const removal = (id: string, disclosure: Disclosure) => ({
      id,
      channelId,
      videoId: VIDEO_IDS.a,
      authorId: ctx.authorId,
      excerpt: 'excerpt',
      reason: 'spam' as const,
      note: null,
      disclosure,
      removedBy: OWNER_ID,
    });
    const count = () => commentsCount(ctx, VIDEO_IDS.a);
    const auditedActions = async () =>
      expectOk(
        await ctx.subject.repositories.channelAudit.list(channelId, { cursor: null, limit: 20 })
      )
        .map((entry) => entry.action)
        .reverse();

    it.each([
      { name: 'hides a root with its public replies', id: C.liked, away: 'hidden', leaves: 3 },
      { name: 'holds a root with its public replies', id: C.liked, away: 'held', leaves: 3 },
      { name: 'hides a reply alone', id: C.reply1, away: 'hidden', leaves: 1 },
      { name: 'holds a root without replies', id: C.fresh, away: 'held', leaves: 1 },
    ] as const)(
      '$name and takes them off the count, then back on',
      async ({ id, away, leaves }) => {
        await seedThreads(ctx);
        const action = away === 'hidden' ? 'hide' : 'hold';
        const restore = away === 'hidden' ? 'unhide' : 'approve';

        const taken = await moderate(id, action, 'published', outcome(away, 'silent'));
        const away_ = await count();
        await moderate(id, restore, away, outcome('published'));

        expect(taken).toMatchObject({ type: 'applied', thread: { id, moderationState: away } });
        expect(away_).toBe(5 - leaves);
        expect(await count()).toBe(5);
      }
    );

    it('records the actor, the disclosure and the reason on the comment', async () => {
      await seedThreads(ctx);

      const result = await moderate(
        C.old,
        'hide',
        'published',
        outcome('hidden', 'visible', 'spam')
      );

      expect(result).toMatchObject({
        type: 'applied',
        thread: {
          moderationState: 'hidden',
          moderationDisclosure: 'visible',
          moderationReason: 'spam',
          moderatedBy: OWNER_ID,
        },
      });
    });

    it.each(['hold', 'hide'] as const)(
      'unpins a pinned comment that %s takes out of public reads',
      async (action) => {
        await seedThreads(ctx);
        expectOk(await ctx.comments.setPinned(target(C.fresh), true));

        const result = await moderate(
          C.fresh,
          action,
          'published',
          outcome(action === 'hold' ? 'held' : 'hidden', 'silent')
        );

        expect(result).toMatchObject({ type: 'applied', thread: { isPinned: false } });
      }
    );

    it.each([
      {
        name: 'a comment that moved to another state',
        id: C.old,
        from: 'held',
        expected: { type: 'stale', state: 'published' },
      },
      {
        name: 'a comment that is not there',
        id: C.other,
        from: 'published',
        expected: { type: 'missing' },
      },
    ] as const)('refuses $name, changing nothing', async ({ id, from, expected }) => {
      await seedThreads(ctx);

      const result = await moderate(id, 'approve', from, outcome('published'));

      expect(result).toEqual(expected);
      expect(await count()).toBe(5);
      expect(await auditedActions()).toEqual([]);
    });

    it('writes one audit row per applied action, in order', async () => {
      await seedThreads(ctx);

      await moderate(C.old, 'hide', 'published', outcome('hidden', 'silent'));
      await moderate(C.old, 'unhide', 'hidden', outcome('published'));

      expect(await auditedActions()).toEqual(['comment.hidden', 'comment.unhidden']);
    });

    it.each([
      { name: 'a comment the gate held', moderation: HELD_AT_CREATION, first: true, delta: 1 },
      {
        name: 'a comment a moderator held after it was public',
        moderation: undefined,
        first: false,
        delta: 0,
      },
    ])(
      'approves $name, a first publication only for the gate: $first',
      async ({ moderation, first }) => {
        await seedComment(ctx, C.old, { moderation });
        if (!moderation) await moderate(C.old, 'hold', 'published', outcome('held', 'visible'));
        const held = await count();

        const result = await moderate(C.old, 'approve', 'held', outcome('published'));

        expect(held).toBe(0);
        expect(result).toMatchObject({ type: 'applied', firstPublication: first });
        expect(await count()).toBe(1);
      }
    );

    it('enqueues the comment job once, on the first publication, and never on an unhide', async () => {
      await seedComment(ctx, C.old, { moderation: HELD_AT_CREATION });

      await moderate(C.old, 'approve', 'held', outcome('published'));
      await moderate(C.old, 'hide', 'published', outcome('hidden', 'silent'));
      await moderate(C.old, 'unhide', 'hidden', outcome('published'));

      const jobs = expectOk(await ctx.subject.repositories.outbox.claimBatch(50)).filter(
        (row) => row.kind === 'notification'
      );
      expect(jobs).toHaveLength(1);
    });

    it('keeps a removed held comment off the count and lists only visible removals of the author', async () => {
      await seedComment(ctx, C.old, { moderation: HELD_AT_CREATION });
      await seedComment(ctx, C.liked);
      await seedComment(ctx, C.fresh);
      for (const [id, disclosure] of [
        [C.old, 'visible'],
        [C.liked, 'silent'],
        [C.fresh, 'visible'],
      ] as const) {
        expectOk(
          await ctx.comments.remove(target(id), {
            audit: audit('remove', id, disclosure),
            removal: removal(id, disclosure),
          })
        );
      }

      const listed = expectOk(
        await ctx.subject.repositories.commentModeration.listRemovals(ctx.authorId, {
          since: new Date(Date.now() - DAY_MS),
          cursor: null,
          limit: 10,
        })
      );

      expect(await count()).toBe(0);
      expect(listed.map(({ id }) => id).sort()).toEqual([C.old, C.fresh].sort());
      expect(await auditedActions()).toEqual([
        'comment.removed',
        'comment.removed',
        'comment.removed',
      ]);
    });

    it('names the ids of a thread and of an author under a video owner, never a removed one', async () => {
      await seedThreads(ctx);
      const { commentModeration } = ctx.subject.repositories;
      expectOk(await ctx.comments.remove(target(C.reply2)));

      const thread = expectOk(await commentModeration.threadIds(target(C.liked)));
      const byAuthor = expectOk(await commentModeration.idsByAuthor(ctx.authorId, OWNER_ID));
      const elsewhere = expectOk(await commentModeration.idsByAuthor(ctx.authorId, ctx.authorId));

      expect(thread.sort()).toEqual([C.liked, C.reply1].sort());
      expect(byAuthor.sort()).toEqual([C.old, C.liked, C.fresh, C.reply1].sort());
      expect(elsewhere).toEqual([]);
    });

    it('purges removals made before the cutoff and keeps the rest', async () => {
      await seedComment(ctx, C.old);
      expectOk(
        await ctx.comments.remove(target(C.old), {
          audit: audit('remove', C.old, 'visible'),
          removal: removal(C.old, 'visible'),
        })
      );
      const { commentModeration } = ctx.subject.repositories;
      const query = { since: new Date(0), cursor: null, limit: 10 };

      expect(
        expectOk(await commentModeration.purgeRemovalsBefore(new Date(Date.now() - DAY_MS)))
      ).toBe(0);
      expect(
        expectOk(await commentModeration.purgeRemovalsBefore(new Date(Date.now() + DAY_MS)))
      ).toBe(1);
      expect(expectOk(await commentModeration.listRemovals(ctx.authorId, query))).toEqual([]);
    });
  });
}
