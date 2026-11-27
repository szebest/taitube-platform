import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, ok, type Result } from '@kit/result';
import type { CommentEditWrite, CommentThread } from '@vp/domain';
import { type AnnounceDeps, announceHeld } from './comment-announce';
import { isVisibleTo, type PublicScopeContext } from './comment-public-scope';
import { type CommentTargetStores, moveCommentsCount } from './comment-targets';
import type { StoredComment } from './comment-visibility';

type EditDeps = AnnounceDeps & CommentTargetStores;

/**
 * The in-memory form of `editComment`: a hold takes the comment and its replies off the target's
 * count and tells the moderators, in one step.
 */
export async function editStored(
  deps: EditDeps,
  comment: StoredComment,
  replies: readonly StoredComment[],
  scope: PublicScopeContext,
  content: string,
  { looksLikeQuestion, hold }: CommentEditWrite,
  toThread: () => Promise<CommentThread>
): Promise<Result<CommentThread, DatabaseUnavailable>> {
  const counted = () => [comment, ...replies].filter((row) => isVisibleTo(null, row, scope)).length;
  const before = counted();
  Object.assign(comment, {
    content,
    looksLikeQuestion,
    isEdited: true,
    updatedAt: new Date(),
    ...(hold && {
      moderationState: 'held',
      moderationDisclosure: hold.disclosure,
      heldReason: hold.reason,
      moderationReason: null,
      moderationNote: null,
      moderatedBy: null,
      moderatedAt: null,
      isPinned: false,
    }),
  });
  await moveCommentsCount(deps, comment.target, counted() - before);

  const thread = await toThread();
  const told = await announceHeld(deps, thread, hold?.moderators ?? []);
  return isErr(told) ? told : ok(thread);
}
