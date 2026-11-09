import type { StoredComment } from '../comment-visibility';

/** The moderation fields of a comment nobody has moderated. */
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
