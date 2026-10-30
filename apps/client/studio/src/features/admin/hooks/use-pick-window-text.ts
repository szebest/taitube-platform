import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

/** A pick's window as one line: its start and end, each with its date and time. */
export function usePickWindowText() {
  const { format } = useFormat();
  const { tOr } = useT();
  const instant = (value: string) => unwrapOr(format({ type: 'dateTime', value }), '');

  return ({ startsAt, endsAt }: { startsAt: string; endsAt: string }) =>
    tOr('studio.pickWindowRange', { start: instant(startsAt), end: instant(endsAt) }, '');
}
