import type { Video, VideoStatus } from '@vp/domain';
import { type UserContext, canDeleteVideo, canUpdateVideo } from '@vp/permissions';
import { type Result, andThen, err, isErr, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize.js';
import {
  type VideoNotFound,
  type VideoStatusNotEligible,
  videoNotFound,
  videoStatusNotEligible,
} from './failures.js';

/** A reprocess re-runs the pipeline over the same source, so the source has to have survived. */
export const REPROCESSABLE_STATUSES: readonly VideoStatus[] = ['READY', 'FAILED', 'PROCESSING'];

export const DELETABLE_STATUSES: readonly VideoStatus[] = [
  'UPLOADING',
  'UPLOADED',
  'PROBING',
  'PROCESSING',
  'READY',
  'FAILED',
  'REJECTED',
  'ABANDONED',
];

export interface VideoLifecycleInput {
  readonly actor: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

export type VideoLifecycleFailure = AuthorizationFailure | VideoNotFound | VideoStatusNotEligible;

/**
 * Order matters. Authentication first, so an anonymous caller cannot probe which ids exist;
 * absence next, because a permission computed against a video that is not there is always `false`
 * and would report every missing video as forbidden; the permission last, over a real entity.
 */
function decide(
  input: VideoLifecycleInput,
  permits: (video: Video) => boolean,
  action: string,
  eligible: readonly VideoStatus[]
): Result<Video, VideoLifecycleFailure> {
  const context = { action, subject: 'Video' };

  const signedIn = authorize(input.actor, true, context);
  if (isErr(signedIn)) return signedIn;

  const video = input.video;
  if (!video) return err(videoNotFound(input.videoId));

  return andThen(
    authorize(signedIn.value, permits(video), context),
    (): Result<Video, VideoStatusNotEligible> =>
      eligible.includes(video.status)
        ? ok(video)
        : err(videoStatusNotEligible(input.videoId, video.status, eligible))
  );
}

export function decideVideoReprocess(
  input: VideoLifecycleInput
): Result<Video, VideoLifecycleFailure> {
  return decide(
    input,
    (video) => canUpdateVideo({ user: input.actor, video }),
    'reprocess',
    REPROCESSABLE_STATUSES
  );
}

export function decideVideoDelete(
  input: VideoLifecycleInput
): Result<Video, VideoLifecycleFailure> {
  return decide(
    input,
    (video) => canDeleteVideo({ user: input.actor, video }),
    'delete',
    DELETABLE_STATUSES
  );
}
