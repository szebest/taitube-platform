import type { VideoSummary } from '@vp/api-contracts';
import { videoDuration } from '@vp/intl';
import { useFormat } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

const MS_PER_SECOND = 1000;

/** How long a video runs, as a card's badge shows it and as a screen reader says it; both undefined while unknown. */
export function useVideoDuration({ durationMs }: Pick<VideoSummary, 'durationMs'>) {
  const { format } = useFormat();

  if (durationMs === undefined) {
    return { duration: undefined, spokenDuration: undefined };
  }

  const seconds = durationMs / MS_PER_SECOND;

  return {
    duration: unwrapOr(format(videoDuration(seconds)), ''),
    spokenDuration: unwrapOr(
      format({
        type: 'duration',
        value: seconds,
        options: { style: 'words', unitDisplay: 'long' },
      }),
      ''
    ),
  };
}
