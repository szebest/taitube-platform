import type { Video } from '@vp/domain';
import { canPinVideo, type UserContext } from '@vp/permissions';
import { andThen, err, isErr, ok, type Result } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  decideVideoRead,
  publicReadFailure,
  type ReadVideoFailure,
  type VideoStatusNotEligible,
  videoStatusNotEligible,
} from '../videos/index';
import { type FeaturedVideoNotPublic, featuredVideoNotPublic } from './failures';

export interface DecideFeaturedVideosInput {
  readonly viewer: UserContext | null;
  readonly videoIds: readonly string[];
  readonly videos: ReadonlyMap<string, Video>;
}

export type FeaturedVideosFailure =
  | ReadVideoFailure
  | AuthorizationFailure
  | VideoStatusNotEligible
  | FeaturedVideoNotPublic;

export function isFeaturable(video: Video): boolean {
  return video.status === 'READY' && video.visibility === 'public';
}

/**
 * Each video is judged in the order given and the first refusal wins. The read comes first, so a
 * private video of someone else answers as absent and the refusal confirms no id.
 */
export function decideFeaturedVideos(
  input: DecideFeaturedVideosInput
): Result<readonly string[], FeaturedVideosFailure> {
  for (const videoId of input.videoIds) {
    const decided = decideOne(input, videoId);
    if (isErr(decided)) return decided;
  }
  return ok(input.videoIds);
}

function decideOne(
  { viewer, videos }: DecideFeaturedVideosInput,
  videoId: string
): Result<Video, FeaturedVideosFailure> {
  const found = videos.get(videoId);
  const video = found && found.status !== 'DELETED' ? found : null;
  const readable = decideVideoRead({ viewer, video, videoId });
  if (isErr(readable)) return err(publicReadFailure(readable.error));

  return andThen(
    authorize(viewer, canPinVideo({ user: viewer, video: readable.value }), {
      action: 'pin',
      subject: 'Video',
    }),
    () => featurable(readable.value)
  );
}

function featurable(video: Video): Result<Video, VideoStatusNotEligible | FeaturedVideoNotPublic> {
  if (video.status !== 'READY')
    return err(videoStatusNotEligible(video.id, video.status, ['READY']));
  if (video.visibility !== 'public') return err(featuredVideoNotPublic(video.id, video.visibility));
  return ok(video);
}
