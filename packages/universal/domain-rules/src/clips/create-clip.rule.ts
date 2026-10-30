import type { Video } from '@vp/domain';
import { type UserContext, canCreateClip } from '@vp/permissions';
import { type Result, andThen, err, map, ok } from '@vp/result';
import { type InvalidClipTitle, validateClipTitle } from '@vp/validation';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ReadVideoFailure,
  type VideoStatusNotEligible,
  decideVideoRead,
  videoStatusNotEligible,
} from '../videos/index';
import { type ClipRange, validateClipRange } from './clip-range.rule';
import type { InvalidClipRange } from './failures';

export interface CreateClipInput extends ClipRange {
  readonly viewer: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
  readonly title: string;
}

export interface ClipToCreate extends ClipRange {
  readonly videoId: string;
  readonly userId: string;
  readonly title: string;
}

export type CreateClipFailure =
  | ReadVideoFailure
  | AuthorizationFailure
  | VideoStatusNotEligible
  | InvalidClipRange
  | InvalidClipTitle;

/**
 * The video read comes first, so a viewer who cannot see the video learns nothing from the refusal;
 * `publicReadFailure` disguises it as absent. A video still transcoding has no duration to clip.
 */
export function decideClipCreate(input: CreateClipInput): Result<ClipToCreate, CreateClipFailure> {
  const { viewer, videoId, startMs, endMs } = input;
  const video = input.video?.status === 'DELETED' ? null : input.video;
  return andThen(decideVideoRead({ viewer, video, videoId }), (readable) =>
    andThen(
      authorize(
        viewer,
        canCreateClip({ user: viewer, clip: { visibility: readable.visibility } }),
        { action: 'create', subject: 'Clip' }
      ),
      (user) =>
        andThen(clippable(readable), (durationMs) =>
          andThen(validateClipRange({ startMs, endMs }, durationMs), (range) =>
            map(validateClipTitle(input.title), (title) => ({
              ...range,
              videoId,
              userId: user.id,
              title,
            }))
          )
        )
    )
  );
}

function clippable(video: Video): Result<number, VideoStatusNotEligible> {
  return video.status === 'READY' && video.durationMs !== null
    ? ok(video.durationMs)
    : err(videoStatusNotEligible(video.id, video.status, ['READY']));
}
