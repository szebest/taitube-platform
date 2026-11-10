import type { Video } from '@vp/domain';
import { type UserContext, canAppealVideo, canReadVideo, canUpdateVideo } from '@vp/permissions';
import { type Result, andThen, err, isErr, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type VideoNotFound,
  type VideoStatusNotEligible,
  videoNotFound,
  videoStatusNotEligible,
} from '../videos/failures';

export interface OwnScreeningInput {
  readonly actor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

export type OwnScreeningFailure = AuthorizationFailure | VideoNotFound;
export type AppealScreeningFailure = OwnScreeningFailure | VideoStatusNotEligible;

/** What stays hidden from a caller who cannot read the video: that it exists at all. */
function ownVideo(
  input: OwnScreeningInput,
  action: string,
  permits: (video: Video) => boolean
): Result<Video, OwnScreeningFailure> {
  const context = { action, subject: 'Video' };
  const signedIn = authorize(input.actor, true, context);
  if (isErr(signedIn)) return signedIn;

  const { video } = input;
  if (!video || !canReadVideo({ user: input.actor, video })) {
    return err(videoNotFound(input.videoId));
  }
  return andThen(authorize(signedIn.value, permits(video), context), () => ok(video));
}

export function decideScreeningRead(input: OwnScreeningInput): Result<Video, OwnScreeningFailure> {
  return ownVideo(input, 'read screening', (video) => canUpdateVideo({ user: input.actor, video }));
}

/**
 * The owner appeals a screening rejection. A video still on hold has nothing to appeal, and a
 * takedown by a moderator is refused by the permission, not by a check of its own.
 */
export function decideScreeningAppeal(
  input: OwnScreeningInput
): Result<Video, AppealScreeningFailure> {
  return andThen(
    ownVideo(input, 'appeal', (video) => canAppealVideo({ user: input.actor, video })),
    (video): Result<Video, AppealScreeningFailure> =>
      video.status === 'REJECTED'
        ? ok(video)
        : err(videoStatusNotEligible(video.id, video.status, ['REJECTED']))
  );
}
