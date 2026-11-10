import type { Video } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import {
  type InvalidSpotlightVideo,
  type SpotlightVideoProblem,
  invalidSpotlightVideo,
} from './failures';

function problemWith(video: Video | null, ownerId: string): SpotlightVideoProblem | null {
  if (video === null || video.status === 'DELETED') return 'missing';
  if (video.ownerId !== ownerId) return 'not-owned';
  if (video.status !== 'READY') return 'not-ready';
  return video.visibility === 'public' ? null : 'not-public';
}

/** Read time: a trailer that turned private drops out of the spotlight without a save. */
export function isSpotlightable(video: Video | null, ownerId: string): video is Video {
  return problemWith(video, ownerId) === null;
}

/** Write time: the refusal names which condition failed, so the studio can say it. */
export function decideSpotlightVideo(
  field: string,
  videoId: string,
  video: Video | null,
  ownerId: string
): Result<Video, InvalidSpotlightVideo> {
  const problem = problemWith(video, ownerId);
  return problem === null && video
    ? ok(video)
    : err(invalidSpotlightVideo(field, videoId, problem ?? 'missing'));
}
