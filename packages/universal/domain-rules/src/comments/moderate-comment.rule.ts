import type { Comment, Video } from '@vp/domain';
import { type UserContext, canDeleteComment, canPinComment } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type CommentNotFound,
  type CommentNotPinnable,
  commentNotFound,
  commentNotPinnable,
} from './failures';

export interface ModerateCommentInput {
  readonly actor: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly video: Video | null;
}

export type DeleteCommentFailure = CommentNotFound | AuthorizationFailure;
export type PinCommentFailure = DeleteCommentFailure | CommentNotPinnable;

interface ModeratedComment {
  readonly comment: Comment;
  readonly video: Video;
}

function located(input: ModerateCommentInput): Result<ModeratedComment, CommentNotFound> {
  return input.comment && input.video
    ? ok({ comment: input.comment, video: input.video })
    : err(commentNotFound(input.commentId));
}

export function decideCommentDelete(
  input: ModerateCommentInput
): Result<Comment, DeleteCommentFailure> {
  return andThen(located(input), ({ comment, video }) =>
    andThen(
      authorize(
        input.actor,
        canDeleteComment({ user: input.actor, comment, videoOwnerId: video.ownerId }),
        { action: 'delete', subject: 'Comment' }
      ),
      () => ok(comment)
    )
  );
}

/** Pinning and unpinning are one decision: only the video owner curates the top of the list. */
export function decideCommentPin(input: ModerateCommentInput): Result<Comment, PinCommentFailure> {
  return andThen(located(input), ({ comment, video }) =>
    andThen(
      authorize(input.actor, canPinComment({ user: input.actor, videoOwnerId: video.ownerId }), {
        action: 'pin',
        subject: 'Comment',
      }),
      (): Result<Comment, CommentNotPinnable> =>
        comment.parentId === null ? ok(comment) : err(commentNotPinnable(comment.id))
    )
  );
}
