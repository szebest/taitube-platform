import type { Video } from '@vp/domain';
import { type UserContext, canReadVideo } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import { type ReadVideoFailure, videoForbidden, videoNotFound } from './failures.js';

export interface ReadVideoInput {
  readonly viewer: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

/**
 * Absent and forbidden are different answers. The public route renders both as 404 and an admin
 * console renders the second as 403; neither decision belongs here, and collapsing them at this
 * point is what destroyed the distinction before ADR-24.
 */
export function decideVideoRead(input: ReadVideoInput): Result<Video, ReadVideoFailure> {
  if (!input.video) return err(videoNotFound(input.videoId));
  if (!canReadVideo({ user: input.viewer, video: input.video })) {
    return err(videoForbidden(input.videoId));
  }
  return ok(input.video);
}
