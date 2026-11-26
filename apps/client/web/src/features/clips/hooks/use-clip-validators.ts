import { isErr } from '@kit/result';
import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { validateClipRange } from '@vp/domain-rules';
import { validateClipTitle } from '@vp/validation';
import type { PlaybackRange } from '#app/components/player/taitube-player';
import { useT } from '#app/lib/messages';

const MS_PER_SECOND = 1000;

/** The checks the API runs on a clip, answering the catalogue's words for each refusal. */
export function useClipValidators() {
  const { tOr } = useT();

  return {
    validateTitle: ({ value }: { value: string }) =>
      isErr(validateClipTitle(value)) ? tOr('clips.titleInvalid', {}, '') : undefined,
    findRangeError: (range: PlaybackRange, durationMs: number) =>
      isErr(validateClipRange(range, durationMs))
        ? tOr(
            'clips.rangeInvalid',
            { min: CLIP_MIN_MS / MS_PER_SECOND, max: CLIP_MAX_MS / MS_PER_SECOND },
            ''
          )
        : undefined,
  };
}
