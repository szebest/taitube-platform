import type { UserEventRepository, VideoRepository } from '@vp/core/repositories';
import type { CommentEditWrite, CommentThread } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result, unwrapOr } from '@vp/result';
import { announceHeld } from './comment-announce';
import { isVisibleTo, type PublicScopeContext } from './comment-public-scope';
import type { StoredComment } from './comment-visibility';

interface EditDeps {
  videosRepo: Pick<VideoRepository, 'findById'>;
  userEventsRepo: Pick<UserEventRepository, 'append'>;
}

/**
 * The in-memory form of `editComment`: a hold takes the comment and its replies off the video's
 * count and tells the moderators, in one step.
 */
export async function editStored(
  { videosRepo, userEventsRepo }: EditDeps,
  comment: StoredComment,
  replies: readonly StoredComment[],
  scope: PublicScopeContext,
  content: string,
  { looksLikeQuestion, hold }: CommentEditWrite,
  toThread: () => Promise<CommentThread>
): Promise<Result<CommentThread, DatabaseUnavailable>> {
  const video = unwrapOr(await videosRepo.findById(comment.videoId), null);
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
  if (video) video.commentsCount = (video.commentsCount ?? 0) + counted() - before;

  const thread = await toThread();
  const told = await announceHeld(userEventsRepo, thread, hold?.moderators ?? []);
  return isErr(told) ? told : ok(thread);
}
