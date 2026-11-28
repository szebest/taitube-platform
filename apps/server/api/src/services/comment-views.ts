import type { CommentView, CreatorInboxCommentView } from '@vp/api-contracts';
import { type CommentThread, type CreatorInboxComment, commentVideoId } from '@vp/domain';
import type { CommentHostTraits } from '@vp/domain-rules';
import { type UserContext, canModerateComment } from '@vp/permissions';

/** The channel the comment is filed under and the user who owns it: who moderates and who is the creator. */
type CommentOwner = Pick<CommentHostTraits, 'ownerId' | 'channelId'>;

type ModerationView = Pick<CommentView, 'status' | 'moderation'>;

const LOOKS_PUBLISHED: ModerationView = { status: 'published', moderation: null };

/**
 * A moderator sees every state in full, the author sees only what the moderator chose to tell
 * them, and a silent state reads as published to everyone else the repository lets see it.
 */
function moderationViewOf(
  thread: CommentThread,
  owner: CommentOwner,
  viewer: UserContext | null
): ModerationView {
  const { moderationState: state, moderationReason: reason } = thread;
  if (state === 'published') return LOOKS_PUBLISHED;

  if (
    canModerateComment({
      user: viewer,
      action: 'hold',
      videoOwnerId: owner.ownerId,
      videoChannelId: owner.channelId,
    })
  ) {
    return {
      status: state,
      moderation: {
        state,
        reason,
        disclosure: thread.moderationDisclosure,
        heldReason: thread.heldReason,
        by: thread.moderatedBy,
        at: thread.moderatedAt?.toISOString() ?? null,
      },
    };
  }

  const toldToAuthor = viewer?.id === thread.authorId && thread.moderationDisclosure === 'visible';
  return toldToAuthor ? { status: state, moderation: { state, reason } } : LOOKS_PUBLISHED;
}

/** `isCreator` is a badge on the wire, never a permission; moderation asks `@vp/permissions`. */
export function toCommentView(
  thread: CommentThread,
  owner: CommentOwner,
  viewer: UserContext | null
): CommentView {
  const { id, target, parentId, content, isPinned, isEdited, likeCount, replyCount } = thread;
  const { author, heartedAt, createdAt, updatedAt } = thread;
  return {
    id,
    target,
    videoId: commentVideoId(target),
    parentId,
    content,
    isPinned,
    isEdited,
    likeCount,
    replyCount,
    heartedByCreator: heartedAt !== null,
    ...moderationViewOf(thread, owner, viewer),
    author: { ...author, isCreator: author.userId === owner.ownerId },
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toCreatorInboxCommentView(
  { video, targetSummary, ...thread }: CreatorInboxComment,
  owner: CommentOwner,
  viewer: UserContext
): CreatorInboxCommentView {
  return { ...toCommentView(thread, owner, viewer), video, targetSummary };
}
