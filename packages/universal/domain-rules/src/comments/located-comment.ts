import type { Comment, Video } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type CommentNotFound, commentNotFound } from './failures';

export interface LocatedCommentInput {
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly video: Video | null;
}

export interface LocatedComment {
  readonly comment: Comment;
  readonly video: Video;
}

export function locateComment(input: LocatedCommentInput): Result<LocatedComment, CommentNotFound> {
  return input.comment && input.video
    ? ok({ comment: input.comment, video: input.video })
    : err(commentNotFound(input.commentId));
}
