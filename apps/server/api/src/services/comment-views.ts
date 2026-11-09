import type { CommentView, CreatorInboxCommentView } from '@vp/api-contracts';
import type { CommentThread, CreatorInboxComment } from '@vp/domain';
import { type UserContext, canModerateComment } from '@vp/permissions';

type ModerationView = Pick<CommentView, 'status' | 'moderation'>;

const LOOKS_PUBLISHED: ModerationView = { status: 'published', moderation: null };

/**
 * A moderator sees every state in full, the author sees only what the moderator chose to tell
 * them, and a silent state reads as published to everyone else the repository lets see it.
 */
function moderationViewOf(
  thread: CommentThread,
  videoOwnerId: string,
  viewer: UserContext | null
): ModerationView {
  const { moderationState: state, moderationReason: reason } = thread;
  if (state === 'published') return LOOKS_PUBLISHED;

  if (canModerateComment({ user: viewer, action: 'hold', videoOwnerId })) {
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
  videoOwnerId: string,
  viewer: UserContext | null
): CommentView {
  const { id, videoId, parentId, content, isPinned, isEdited, likeCount, replyCount } = thread;
  const { author, heartedAt, createdAt, updatedAt } = thread;
  return {
    id,
    videoId,
    parentId,
    content,
    isPinned,
    isEdited,
    likeCount,
    replyCount,
    heartedByCreator: heartedAt !== null,
    ...moderationViewOf(thread, videoOwnerId, viewer),
    author: { ...author, isCreator: author.userId === videoOwnerId },
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

export function toCreatorInboxCommentView(
  { video, ...thread }: CreatorInboxComment,
  videoOwnerId: string,
  viewer: UserContext
): CreatorInboxCommentView {
  return { ...toCommentView(thread, videoOwnerId, viewer), video };
}
