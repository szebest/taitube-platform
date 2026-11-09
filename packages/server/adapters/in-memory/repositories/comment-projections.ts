import type { AuthoredComment, Channel, CommentThread } from '@vp/domain';
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
