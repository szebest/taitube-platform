import { type Result, andThen, err, ok } from '@kit/result';
import type { Video } from '@vp/domain';
import { canReadVideoStats } from '@vp/permissions';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import { analyticsForbidden } from './failures';
import type { VideoAnalyticsInput } from './read-analytics.rule';

/** The read first, as for analytics, so a video the caller cannot see stays absent and only a visible one answers 403. */
export function decideVideoStatsRead(input: VideoAnalyticsInput): Result<Video, ReadVideoFailure> {
  return andThen(
    decideVideoRead({ viewer: input.viewer, video: input.video, videoId: input.videoId }),
    (video) =>
      canReadVideoStats({ user: input.viewer, video: { ownerId: video.ownerId } })
        ? ok(video)
        : err(analyticsForbidden(input.videoId))
  );
}
