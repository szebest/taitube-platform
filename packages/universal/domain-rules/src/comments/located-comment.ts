import { type Result, err, ok } from '@kit/result';
import type { Comment, CommentHost } from '@vp/domain';
import { type CommentNotFound, commentNotFound } from './failures';

export interface LocatedCommentInput {
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly host: CommentHost | null;
}

export interface LocatedComment {
  readonly comment: Comment;
  readonly host: CommentHost;
}

export function locateComment(input: LocatedCommentInput): Result<LocatedComment, CommentNotFound> {
  return input.comment && input.host
    ? ok({ comment: input.comment, host: input.host })
    : err(commentNotFound(input.commentId));
}
