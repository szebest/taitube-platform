import type { Result } from '@kit/result';
import type { DatabaseUnavailable } from '@vp/errors';

/**
 * The only reader of `videos.access_password_hash`: every other read of a video sees
 * `passwordProtected` alone, so the hash cannot reach a response by accident.
 */
export abstract class VideoPasswordRepository {
  abstract hashOf(videoId: string): Promise<Result<string | null, DatabaseUnavailable>>;
  /** `null` removes the password; `false` when there is no such video. */
  abstract setHash(
    videoId: string,
    hash: string | null
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}
