import type { CommentResource } from '../types';

/**
 * Normalizes any comment-like input into a canonical CommentResource.
 * Resolves authorId fallback from userId and videoOwnerId fallback.
 */
export function normalizeCommentResource(
  input?: Partial<CommentResource> | null,
  videoOwnerId?: string
): CommentResource | undefined {
  if (!(input || videoOwnerId)) return undefined;

  const base = input ?? {};
  const authorId = base.authorId ?? base.userId;
  const effectiveVideoOwnerId = videoOwnerId ?? base.videoOwnerId;

  return {
    ...base,
    ...(authorId !== undefined ? { authorId } : {}),
    ...(effectiveVideoOwnerId !== undefined ? { videoOwnerId: effectiveVideoOwnerId } : {}),
  };
}
