import type { CreatorInboxComment, VideoThreadEntry } from '@vp/domain';

/** A held thread as the inbox row a held comment would be: its text is what the moderator judges. */
export function heldThreadInboxRow(
  { thread, author, replyCount }: VideoThreadEntry,
  video: { id: string; title: string }
): CreatorInboxComment {
  return {
    id: thread.id,
    target: { type: 'thread', id: thread.id },
    channelId: thread.channelId,
    authorId: thread.authorId,
    authorChannelId: thread.authorChannelId,
    parentId: null,
    content: `${thread.title}\n${thread.body}`.trim(),
    isPinned: false,
    isEdited: false,
    likeCount: 0,
    heartedAt: null,
    createdAt: thread.createdAt,
    updatedAt: thread.createdAt,
    moderationState: thread.moderationState,
    moderationDisclosure: thread.moderationDisclosure,
    moderationReason: null,
    moderationNote: null,
    moderatedBy: null,
    moderatedAt: null,
    heldReason: thread.heldReason,
    looksLikeQuestion: false,
    author: {
      userId: thread.authorId,
      channelId: thread.authorChannelId,
      handle: author.handle,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
    },
    replyCount,
    video,
    targetSummary: { type: 'thread', id: thread.id, title: thread.title },
  };
}
