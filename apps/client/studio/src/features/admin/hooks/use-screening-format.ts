import { videoDuration } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

const PERCENT = 100;

export interface SecondsRange {
  fromSeconds: number;
  toSeconds: number;
}

/** A moment of a video the way a player shows it: `1:05`. */
export function useClock() {
  const { format } = useFormat();

  return (seconds: number) => unwrapOr(format(videoDuration(seconds)), '');
}

/** A share between 0 and 1 as a percentage in the viewer's locale. */
export function useShare() {
  const { format } = useFormat();

  return (share: number) => unwrapOr(format({ type: 'percent', value: share * PERCENT }), '');
}

/** A span of a video as words: `0:12 to 1:05`. */
export function useSecondsRange() {
  const { tOr } = useT();
  const clock = useClock();

  return ({ fromSeconds, toSeconds }: SecondsRange) =>
    tOr('studio.screeningRange', { from: clock(fromSeconds), to: clock(toSeconds) }, '');
}
