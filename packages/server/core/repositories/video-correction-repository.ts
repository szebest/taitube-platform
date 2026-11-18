import type { Result } from '@kit/result';
import type { Correction } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export abstract class VideoCorrectionRepository {
  /** Ordered by start. */
  abstract list(videoId: string): Promise<Result<Correction[], DatabaseUnavailable>>;
  /** `false` when the video already holds `limit`, decided in the same statement as the insert. */
  abstract create(
    correction: Correction,
    limit: number
  ): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract remove(
    videoId: string,
    correctionId: string
  ): Promise<Result<boolean, DatabaseUnavailable>>;
}
