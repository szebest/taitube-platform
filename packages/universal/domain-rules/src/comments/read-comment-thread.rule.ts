import { type Result, err, map } from '@kit/result';
import type { Comment, CommentHost } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type ReadCommentHostFailure, decideCommentHostRead } from './comment-host';
import { type CommentNotFound, commentNotFound } from './failures';

export interface ReadCommentThreadInput {
  readonly viewer: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly host: CommentHost | null;
}

export type ReadCommentThreadFailure = CommentNotFound | ReadCommentHostFailure;

export function decideCommentThreadRead(
  input: ReadCommentThreadInput
): Result<{ comment: Comment; host: CommentHost }, ReadCommentThreadFailure> {
  const { comment, host } = input;
  if (!(comment && host)) return err(commentNotFound(input.commentId));

  return map(decideCommentHostRead(input.viewer, host), () => ({ comment, host }));
}
