import type { Channel, FeedbackTarget, Video } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { err, isErr, map, ok, type Result } from '@vp/result';
import { type ChannelNotFound, channelNotFound } from '../channels/failures';
import type { VideoForbidden, VideoNotFound, VideoReadRequiresAuth } from '../videos/failures';
import { decideVideoRead, publicReadFailure } from '../videos/read-video.rule';

export interface RecommendationFeedbackTargetInput {
  readonly viewer: UserContext | null;
  readonly target: FeedbackTarget;
  /** What the repository found for the target: the video for `not_interested`, the channel for `hide_channel`. */
  readonly video: Video | null;
  readonly channel: Channel | null;
}

export type RecommendationFeedbackTargetFailure =
  | VideoNotFound
  | VideoReadRequiresAuth
  | VideoForbidden
  | ChannelNotFound;

/** A video the caller may not read is as absent as an unknown one: feedback must not confirm it exists. */
export function decideRecommendationFeedbackTarget(
  input: RecommendationFeedbackTargetInput
): Result<FeedbackTarget, RecommendationFeedbackTargetFailure> {
  const { viewer, target, video, channel } = input;

  switch (target.kind) {
    case 'not_interested': {
      const readable = decideVideoRead({ viewer, video, videoId: target.videoId });
      return isErr(readable) ? err(publicReadFailure(readable.error)) : map(readable, () => target);
    }
    case 'hide_channel':
      return channel ? ok(target) : err(channelNotFound(target.channelId));
  }
}
