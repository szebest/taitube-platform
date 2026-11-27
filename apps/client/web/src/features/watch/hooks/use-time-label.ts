import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { videoDuration } from '@vp/intl-formats';

const MS_PER_SECOND = 1000;

/** Writes a moment of a video, in milliseconds, the way the player's clock does. */
export function useTimeLabel(): (ms: number) => string {
  const { format } = useFormat();

  return (ms) => unwrapOr(format(videoDuration(Math.floor(ms / MS_PER_SECOND))), '');
}
