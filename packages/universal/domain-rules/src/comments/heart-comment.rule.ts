import type { Comment } from '@vp/domain';
import { canHeartComment } from '@vp/permissions';
import { andThen, ok, type Result } from '@vp/result';
import { authorize } from '../authorize';
import { locateComment } from './located-comment';
import type { DeleteCommentFailure, ModerateCommentInput } from './moderate-comment.rule';

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
