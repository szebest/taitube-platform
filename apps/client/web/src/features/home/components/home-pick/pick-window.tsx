import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';

import { PickOfTheDay } from '#app/components/discovery/pick-of-the-day';
import { usePickWindow } from '#app/features/home/hooks/use-pick-window';

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;

export interface PickWindowProps {
  endsAt: string;
}

/** "Picked today, 14 h left", in whole hours and then in minutes for the last hour. */
export function PickWindow({ endsAt }: PickWindowProps) {
  const minutes = usePickWindow(endsAt);
  const { tOr } = useT();
  const { format } = useFormat();

  const left =
    minutes === undefined || minutes <= 0
      ? undefined
      : unwrapOr(
          format({
            type: 'duration',
            value:
              (minutes < MINUTES_PER_HOUR
                ? minutes
                : Math.floor(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR) * SECONDS_PER_MINUTE,
            options: { style: 'words', unitDisplay: 'short' },
          }),
          ''
        );

  return (
    <PickOfTheDay.Window>
      {left === undefined ? '' : tOr('home.pickWindow', { left }, '')}
    </PickOfTheDay.Window>
  );
}
