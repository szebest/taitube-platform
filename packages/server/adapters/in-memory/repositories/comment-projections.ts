import {
  type AuthoredComment,
  type Channel,
  type CommentThread,
  type NewCommentInput,
  PUBLISHED_AT_CREATION,
} from '@vp/domain';
import type { StoredComment } from './comment-visibility';

export function toThreadOf(
  stored: StoredComment,
  channel: Channel | null,
  replyCount: number
): CommentThread {
  const { deletedAt: _deletedAt, ...comment } = stored;
  return {
    ...comment,
    author: {
      userId: comment.authorId,
      channelId: channel?.id ?? null,
      handle: channel?.handle ?? null,
      displayName: channel?.displayName ?? null,
      avatarUrl: channel?.avatarUrl ?? null,
    },
    replyCount,
  };
}

export function toAuthoredCommentOf(
  { id, content, createdAt, parentId, likeCount }: StoredComment,
  video: { id: string; title?: string | null }
): AuthoredComment {
  return {
    id,
    content,
    createdAt,
    parentId,
    likeCount,
    video: { id: video.id, title: video.title ?? '' },
  };
}

export function newStoredComment(input: NewCommentInput, now: Date): StoredComment {
  const { moderation, ...fields } = input;
  return {
    ...fields,
    ...(moderation ?? PUBLISHED_AT_CREATION),
    moderationReason: null,
    moderationNote: null,
    moderatedBy: null,
    moderatedAt: null,
    isPinned: false,
    isEdited: false,
    likeCount: 0,
    heartedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}
