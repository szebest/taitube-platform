import type { DatabaseUnavailable } from '@kit/errors';
import type { Result } from '@kit/result';
import type { Chapter } from '@vp/domain';

/**
 * Reads only: the set is replaced inside `VideoStudioRepository.updateMetadata`, in the edit's own
 * transaction, so a chapter never changes without a version bump and a revision.
 */
export abstract class VideoChapterRepository {
  /** Every id gets an entry, ordered by start, empty for a video without chapters. */
  abstract listFor(
    videoIds: readonly string[]
  ): Promise<Result<Map<string, Chapter[]>, DatabaseUnavailable>>;
}
