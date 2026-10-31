import { err, ok, type Result } from '@vp/result';
import { type InvalidField, invalidField } from '../failures';

export type InvalidFeaturedSelection = InvalidField<{ readonly max: number }>;

export function validateFeaturedSelection(
  videoIds: readonly string[],
  max: number
): Result<readonly string[], InvalidFeaturedSelection> {
  if (videoIds.length > max) {
    return err(invalidField('videoIds', `Pin at most ${max} videos`, { max }));
  }
  if (new Set(videoIds).size !== videoIds.length) {
    return err(invalidField('videoIds', 'Pin each video once', { max }));
  }
  return ok(videoIds);
}
