import { type Result, andThen, map } from '@kit/result';
import type { Comment, CommentHost, CommentModerationAction, ModerationOutcome } from '@vp/domain';
import { type UserContext, canModerateComment } from '@vp/permissions';
import { type AuthorizationFailure, authorize } from '../authorize';
import { applyModeration } from './apply-moderation.rule';
import { commentOwnership } from './comment-host';
import type { CommentNotFound, ModerationNotApplicable } from './failures';
import { locateComment } from './located-comment';

export interface CommentModerationInput {
  readonly actor: UserContext | null;
  readonly comment: Comment | null;
  readonly commentId: string;
  readonly host: CommentHost | null;
  readonly action: CommentModerationAction;
}

export interface CommentModerationDecision {
  readonly comment: Comment;
  readonly host: CommentHost;
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
  return andThen(locateComment(input), ({ comment, host }) =>
    andThen(
      authorize(
        actor,
        canModerateComment({ user: actor, action: action.action, ...commentOwnership(host) }),
        { action: action.action, subject: 'Comment' }
      ),
      () =>
        map(applyModeration(comment.moderationState, action), (outcome) => ({
          comment,
          host,
          outcome,
        }))
    )
  );
}
