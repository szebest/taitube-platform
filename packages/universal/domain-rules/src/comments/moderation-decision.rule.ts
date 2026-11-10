import type { Comment, CommentModerationAction, ModerationOutcome, Video } from '@vp/domain';
import { type UserContext, canModerateComment } from '@vp/permissions';
import { type Result, andThen, map } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { applyModeration } from './apply-moderation.rule';
import type { CommentNotFound, ModerationNotApplicable } from './failures';
import { locateComment } from './located-comment';

export interface CommentModerationInput {
  readonly actor: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly video: Video | null;
  readonly action: CommentModerationAction;
}

export interface CommentModerationDecision {
  readonly comment: Comment;
  readonly video: Video;
  readonly outcome: ModerationOutcome;
}

export type CommentModerationFailure =
  | CommentNotFound
  | AuthorizationFailure
  | ModerationNotApplicable;

/** Each action is its own permission, so a role that drops one keeps the rest. */
export function decideCommentModeration(
  input: CommentModerationInput
): Result<CommentModerationDecision, CommentModerationFailure> {
  const { actor, action } = input;
  return andThen(locateComment(input), ({ comment, video }) =>
    andThen(
      authorize(
        actor,
        canModerateComment({ user: actor, action: action.action, videoOwnerId: video.ownerId }),
        { action: action.action, subject: 'Comment' }
      ),
      () =>
        map(applyModeration(comment.moderationState, action), (outcome) => ({
          comment,
          video,
          outcome,
        }))
    )
  );
}
