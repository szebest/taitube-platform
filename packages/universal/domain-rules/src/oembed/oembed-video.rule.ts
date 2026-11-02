import type { Video } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type VideoNotFound, videoNotFound } from '../videos/index';

/** Only what anyone can watch is embeddable; every other state answers as if the video did not exist. */
export function decideOEmbedVideo(
  video: Video | null,
  videoId: string
): Result<Video, VideoNotFound> {
  const embeddable = video?.visibility === 'public' && video.status === 'READY' && !video.deletedAt;
  return video && embeddable ? ok(video) : err(videoNotFound(videoId));
}
