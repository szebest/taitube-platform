import { useFormat } from '@kit/intl-react';
import { assertNever, unwrapOr } from '@kit/result';
import { videoDuration } from '@vp/intl-formats';
import { useT } from '#app/lib/messages';
import { toSegmentRange } from '../utils/segment-range';

const MS_PER_SECOND = 1000;

/** `clock(ms)` as the player's clock writes it, and `segment(start, end)` as the row's finished string. */
export function useSegmentText() {
  const { format } = useFormat();
  const { tOr } = useT();

  const clock = (ms: number) => unwrapOr(format(videoDuration(ms / MS_PER_SECOND)), '');

  const segment = (startMs: number | null, endMs: number | null): string | null => {
    const range = toSegmentRange(startMs, endMs);
    switch (range.kind) {
      case 'whole':
        return null;
      case 'from':
        return tOr('playlistEdit.segmentFrom', { start: clock(range.startMs) }, '');
      case 'range':
        return tOr(
          'playlistEdit.segmentRange',
          { start: clock(range.startMs), end: clock(range.endMs) },
          ''
        );
      default:
        return assertNever(range, 'SegmentRange');
    }
  };

  return { clock, segment };
}
