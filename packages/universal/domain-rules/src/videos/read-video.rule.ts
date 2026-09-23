import type { Video } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';
import { type UserContext, canReadVideo } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import {
  type ReadVideoFailure,
  type VideoForbidden,
  type VideoNotFound,
  type VideoReadRequiresAuth,
  videoForbidden,
  videoNotFound,
  videoReadRequiresAuth,
} from './failures.js';

export interface ReadVideoInput {
  readonly viewer: UserContext | null;
  readonly video: Video | null;
  readonly videoId: string;
}

/**
 * Three answers, kept apart. The public route renders absent and forbidden alike as 404 and an
 * admin console renders forbidden as 403; neither decision belongs here, and collapsing them at
 * this point is what destroyed the distinction before ADR-24.
 *
 * Anonymous is its own answer for the same reason `authorize` separates it: a caller with no token
 * can fix a 401 and can do nothing with a 403.
 */
export function decideVideoRead(input: ReadVideoInput): Result<Video, ReadVideoFailure> {
  if (!input.video) return err(videoNotFound(input.videoId));
  if (canReadVideo({ user: input.viewer, video: input.video })) return ok(input.video);
  if (!input.viewer) return err(videoReadRequiresAuth(input.videoId));
  return err(videoForbidden(input.videoId));
}

/**
 * What an unprivileged consumer may learn. A `FORBIDDEN` on a video the caller cannot read becomes
 * `VIDEO_NOT_FOUND`, because a 403 would confirm the id exists and that is the leak the disguise
 * exists to close. A refusal to edit a video they *can* read stays a 403, and `UNAUTHORIZED`
 * survives too, because a caller with no token can act on it.
 *
 * One owner, because the public route, the PATCH route and the SSE stream all need it and three
 * copies of a security decision is how they drift apart.
 */
export function publicReadFailure(
  failure: ReadVideoFailure
): VideoNotFound | VideoReadRequiresAuth | VideoForbidden {
  return failure.code === ErrorCodes.FORBIDDEN && !failure.readable
    ? videoNotFound(failure.videoId)
    : failure;
}
