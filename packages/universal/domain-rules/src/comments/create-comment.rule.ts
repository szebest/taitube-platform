import { type Result, andThen, err, map, ok } from '@kit/result';
import { type Comment, type CommentHost, type CommentTarget, threadRootId } from '@vp/domain';
import { type UserContext, canCreateComment } from '@vp/permissions';
import { type InvalidCommentContent, validateCommentContent } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ReadCommentHostFailure,
  decideCommentHostRead,
  commentTargetNotFound,
} from './comment-host';
import { type CommentNotFound, commentNotFound } from './failures';

export interface CreateCommentInput {
  readonly author: UserContext | null;
  readonly host: CommentHost | null;
  readonly target: CommentTarget;
  readonly parent: Comment | null;
  readonly parentId: string | null;
  readonly content: string;
}

export interface CommentToCreate {
  readonly host: CommentHost;
  readonly parentId: string | null;
  readonly content: string;
}

export type CreateCommentFailure =
  | AuthorizationFailure
  | ReadCommentHostFailure
  | CommentNotFound
  | InvalidCommentContent;

function threadParent(input: CreateCommentInput): Result<string | null, CommentNotFound> {
  if (input.parentId === null) return ok(null);
  const { parent, target } = input;
  if (!parent || parent.target.type !== target.type || parent.target.id !== target.id) {
    return err(commentNotFound(input.parentId));
  }
  return ok(threadRootId(parent));
}

/**
 * Permission first, so an anonymous caller learns nothing about which targets exist. A parent
 * under another target is reported absent rather than forbidden: from this one it is not there.
 */
export function decideCommentCreate(
  input: CreateCommentInput
): Result<CommentToCreate, CreateCommentFailure> {
  return andThen(
    authorize(input.author, canCreateComment({ user: input.author }), {
      action: 'create',
      subject: 'Comment',
    }),
    (author): Result<CommentToCreate, CreateCommentFailure> =>
      andThen(
        input.host
          ? decideCommentHostRead(author, input.host)
          : err(commentTargetNotFound(input.target)),
        (host) =>
          andThen(threadParent(input), (parentId) =>
            map(validateCommentContent(input.content), (content) => ({ host, parentId, content }))
          )
      )
  );
}
