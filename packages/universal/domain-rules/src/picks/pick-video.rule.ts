import type { Video } from '@vp/domain';
import { type Result, err, ok } from '@vp/result';
import { type VideoNotFound, videoNotFound } from '../videos/index';
import { type InvalidPickVideo, invalidPickVideo } from './failures';

export type PickVideoFailure = VideoNotFound | InvalidPickVideo;

export function decidePickVideo(
  video: Video | null,
  videoId: string
): Result<Video, PickVideoFailure> {
  if (!video || video.status === 'DELETED') return err(videoNotFound(videoId));
  return video.visibility === 'public' && video.status === 'READY'
    ? ok(video)
    : err(invalidPickVideo(videoId));
}
