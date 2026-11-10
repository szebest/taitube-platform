import { expectOk } from '@vp/testing/result';
import { C, seedComment, seedThreads } from './comment-contract-context';
import { HELD_AT_CREATION, describeModerationFixture, outcome } from './comment-moderation-fixture';
import { OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';

export function describeCommentModerationRepositoryContract(
  makeSubject: MakeRepositoriesSubject
): void {
  describeModerationFixture('CommentModerationRepository contract', makeSubject, (f) => {
    const { ctx, target, moderate, count, auditedActions } = f;
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
  });
}
