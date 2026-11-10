import type { StoredComment } from '../comment-visibility';

/** @internal The moderation fields of a comment nobody has moderated. */
export const UNMODERATED = {
  moderationState: 'published',
  moderationDisclosure: null,
  moderationReason: null,
  moderationNote: null,
  moderatedBy: null,
  moderatedAt: null,
  heldReason: null,
  looksLikeQuestion: false,
} as const satisfies Partial<StoredComment>;

/** @internal */
export function aStoredComment(overrides: Partial<StoredComment> = {}): StoredComment {
  return {
    id: 'comment-1',
    parentId: null,
    deletedAt: null,
    videoId: 'video-1',
    authorId: 'author-1',
    content: 'hello',
    isPinned: false,
    isEdited: false,
    likeCount: 0,
    heartedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...UNMODERATED,
    ...overrides,
  };
}
