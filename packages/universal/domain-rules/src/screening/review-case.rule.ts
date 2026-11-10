import type { ScreeningAppeal, Video } from '@vp/domain';
import { type VersionConflict, versionConflict } from '@vp/errors';
import { type UserContext, canModerateVideo } from '@vp/permissions';
import { type Result, andThen, err, isErr, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type VideoNotFound, videoNotFound } from '../videos/failures';

const CONTEXT = { action: 'moderate', subject: 'Video' } as const;
const DIFFERENT_MODERATOR =
  'A moderator other than the one who rejected the video decides its appeal';

export function decideScreeningQueueAccess(
  actor: UserContext | null
): Result<UserContext, AuthorizationFailure> {
  return authorize(actor, canModerateVideo({ user: actor }), CONTEXT);
}

export type ScreeningAction = 'approve' | 'reject' | 'dismiss';

export interface ReviewScreeningInput {
  readonly actor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly action: ScreeningAction;
  /** The appeal waiting on this decision, if the video was rejected and appealed. */
  readonly openAppeal: Pick<ScreeningAppeal, 'rejectedBy'> | null;
}

export type ReviewScreeningFailure = AuthorizationFailure | VideoNotFound | VersionConflict;

/**
 * Approve and reject act on a held video only, so a moderator who lost a race to another finds the video
 * no longer held and gets the conflict, not a second decision. An appeal is decided by someone
 * other than the moderator who rejected the video.
 */
export function decideScreeningReview(
  input: ReviewScreeningInput
): Result<Video, ReviewScreeningFailure> {
  const { actor, video, videoId, action, openAppeal } = input;

  const signedIn = authorize(actor, true, CONTEXT);
  if (isErr(signedIn)) return signedIn;
  if (!video) return err(videoNotFound(videoId));

  return andThen(
    authorize(actor, canModerateVideo({ user: actor, video }), CONTEXT),
    (moderator): Result<Video, ReviewScreeningFailure> => {
      if (action === 'dismiss') return ok(video);
      if (video.status !== 'HELD') return err(versionConflict(videoId));

      const sameModerator = openAppeal !== null && openAppeal.rejectedBy === moderator.id;
      return andThen(
        authorize(moderator, !sameModerator, { ...CONTEXT, message: DIFFERENT_MODERATOR }),
        () => ok(video)
      );
    }
  );
}
