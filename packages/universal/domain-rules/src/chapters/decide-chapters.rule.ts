import { type Result, andThen, err, ok } from '@kit/result';
import type { Chapter } from '@vp/domain';
import { type InvalidChapters, invalidChapters } from './failures';
import { validateChapters } from './validate-chapters.rule';

/** The last chapter has to start before the video ends, which only the entity knows. */
export function decideChapters(
  chapters: readonly Chapter[],
  video: { readonly durationMs: number | null }
): Result<Chapter[], InvalidChapters> {
  return andThen(validateChapters(chapters), (sorted) => {
    const last = sorted[sorted.length - 1];
    if (video.durationMs !== null && last && last.startMs >= video.durationMs) {
      return err(invalidChapters('Every chapter starts before the video ends'));
    }
    return ok(sorted);
  });
}
