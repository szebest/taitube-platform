import type { Comment } from '@vp/domain';
import { type UserContext, canUpdateComment } from '@vp/permissions';
import { type Result, andThen, err, map } from '@vp/result';
import { type InvalidCommentContent, validateCommentContent } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type CommentNotFound, commentNotFound } from './failures';

export interface UpdateCommentInput {
  readonly actor: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly content: string;
}

export interface CommentEdit {
  readonly comment: Comment;
  readonly content: string;
}

export type UpdateCommentFailure = CommentNotFound | AuthorizationFailure | InvalidCommentContent;

/** Only the author rewrites their words; moderation removes a comment, it never edits one. */
export function decideCommentUpdate(
  input: UpdateCommentInput
): Result<CommentEdit, UpdateCommentFailure> {
  const { actor, comment } = input;
  if (!comment) return err(commentNotFound(input.commentId));

  return andThen(
    authorize(actor, canUpdateComment({ user: actor, comment }), {
      action: 'update',
      subject: 'Comment',
    }),
    () => map(validateCommentContent(input.content), (content) => ({ comment, content }))
  );
}
