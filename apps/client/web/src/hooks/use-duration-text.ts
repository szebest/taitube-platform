import { videoDuration } from '@vp/intl';
import { useFormat } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

const MS_PER_SECOND = 1000;

export interface DurationText {
  /** The clock text, `12:45`. */
  clock: string | undefined;
  /** The same as a screen reader says it, `12 minutes 45 seconds`. */
  spoken: string | undefined;
}

export function useDurationText(durationMs: number | undefined): DurationText {
  const { format } = useFormat();

  if (durationMs === undefined) {
    return { clock: undefined, spoken: undefined };
  }

  const seconds = durationMs / MS_PER_SECOND;
  return {
    clock: unwrapOr(format(videoDuration(seconds)), ''),
    spoken: unwrapOr(
      format({
        type: 'duration',
        value: seconds,
        options: { style: 'words', unitDisplay: 'long' },
      }),
      ''
    ),
  };
}
