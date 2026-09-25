import { ErrorCodes, type Failure } from '@vp/errors';

export type CommentNotFound = Failure<typeof ErrorCodes.COMMENT_NOT_FOUND, { commentId: string }>;

export type CommentNotPinnable = Failure<
  typeof ErrorCodes.COMMENT_NOT_PINNABLE,
  { commentId: string }
>;

export function commentNotFound(commentId: string): CommentNotFound {
  return { code: ErrorCodes.COMMENT_NOT_FOUND, message: 'Comment not found', commentId };
}

export function commentNotPinnable(commentId: string): CommentNotPinnable {
  return {
    code: ErrorCodes.COMMENT_NOT_PINNABLE,
    message: 'Only a top-level comment can be pinned',
    commentId,
  };
}
