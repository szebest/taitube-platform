import type { Comment } from '@vp/domain';
import { canHeartComment } from '@vp/permissions';
import { type Result, andThen, ok } from '@vp/result';
import { authorize } from '../authorize';
import type { DeleteCommentFailure, ModerateCommentInput } from './moderate-comment.rule';
import { locateComment } from './located-comment';

export type HeartCommentFailure = DeleteCommentFailure;

/** Only the video owner hearts, and un-hearts: the heart is the creator's, so it is one decision. */
export function decideCommentHeart(
  input: ModerateCommentInput
): Result<Comment, HeartCommentFailure> {
  return andThen(locateComment(input), ({ comment, video }) =>
    andThen(
      authorize(input.actor, canHeartComment({ user: input.actor, videoOwnerId: video.ownerId }), {
        action: 'heart',
        subject: 'Comment',
      }),
      () => ok(comment)
    )
  );
}
