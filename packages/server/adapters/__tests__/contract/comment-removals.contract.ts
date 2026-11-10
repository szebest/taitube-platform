import { expectOk } from '@vp/testing/result';
import { C, seedComment, seedThreads } from './comment-contract-context';
import { HELD_AT_CREATION, describeModerationFixture } from './comment-moderation-fixture';
import { OWNER_ID } from './fixtures';
import type { MakeRepositoriesSubject } from './subjects';

const DAY_MS = 86_400_000;

export function describeCommentRemovalsContract(makeSubject: MakeRepositoriesSubject): void {
  describeModerationFixture('CommentRemovals contract', makeSubject, (f) => {
    const { ctx, target, audit, removal, count, auditedActions } = f;
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
