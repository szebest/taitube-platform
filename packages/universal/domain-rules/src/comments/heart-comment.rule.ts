import { type Result, andThen, ok } from '@kit/result';
import type { Comment } from '@vp/domain';
import { canHeartComment } from '@vp/permissions';
import { authorize } from '../authorize';
import { commentOwnership } from './comment-host';
import { locateComment } from './located-comment';
import type { DeleteCommentFailure, ModerateCommentInput } from './moderate-comment.rule';

export type HeartCommentFailure = DeleteCommentFailure;

/** Only the creator hearts, and un-hearts: the heart is the creator's, so it is one decision. */
export function decideCommentHeart(
  input: ModerateCommentInput
): Result<Comment, HeartCommentFailure> {
  return andThen(locateComment(input), ({ comment, host }) =>
    andThen(
      authorize(input.actor, canHeartComment({ user: input.actor, ...commentOwnership(host) }), {
        action: 'heart',
        subject: 'Comment',
      }),
      () => ok(comment)
    )
  );
}
