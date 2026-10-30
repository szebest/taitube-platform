import type { Video } from '@vp/domain';
import { type UserContext, canReadAnalytics } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ReadVideoFailure, decideVideoRead } from '../videos/index';
import { analyticsForbidden } from './failures';

export interface VideoAnalyticsInput {
  readonly viewer: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

/**
 * Composes the read, so a stranger asking about a private video gets the read's verdict, which the
 * public edge disguises as absent, and only one who can already see the video learns it is not theirs.
 */
export function decideVideoAnalyticsRead(
  input: VideoAnalyticsInput
): Result<Video, ReadVideoFailure> {
  return andThen(
    decideVideoRead({ viewer: input.viewer, video: input.video, videoId: input.videoId }),
    (video) =>
      canReadAnalytics({ user: input.viewer, analytics: { ownerId: video.ownerId } })
        ? ok(video)
        : err(analyticsForbidden(input.videoId))
  );
}

/** A channel's analytics are its owner's, so the caller asks about their own. */
export function decideChannelAnalyticsRead(
  viewer: UserContext | null
): Result<UserContext, AuthorizationFailure> {
  return authorize(
    viewer,
    viewer !== null && canReadAnalytics({ user: viewer, analytics: { ownerId: viewer.id } }),
    { action: 'read', subject: 'Analytics' }
  );
}
