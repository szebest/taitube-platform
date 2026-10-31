import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { cn } from '@vp/ui';

import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { usePickWindowText } from '#app/features/admin/hooks/use-pick-window-text';
import { calendarDays, picksOnDay } from '#app/features/admin/lib/pick-days';

export interface PickCalendarProps {
  picks: readonly AdminPick[];
  /** The first day shown, and the instant "running now" is judged against. */
  now: Date;
  /** Only given to someone who may manage picks; without it a chip is plain text. */
  onEdit?: (pick: AdminPick) => void;
}

const CHIP =
  'tw:flex tw:w-full tw:flex-col tw:gap-0.5 tw:rounded-control tw:border-0 tw:bg-accent-soft tw:px-inset-control tw:py-inline tw:text-start tw:text-caption tw:text-accent-ink';

/** The next 30 days as a grid of days; a pick sits on every day its window touches. */
export function PickCalendar({ picks, now, onEdit }: PickCalendarProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const windowText = usePickWindowText();
  const today = calendarDays(now, 1)[0];

  return (
    <ol
      aria-label={tOr('studio.pickCalendar', {}, '')}
      className="tw:m-0 tw:grid tw:list-none tw:grid-cols-2 tw:gap-inline tw:p-0 tw:medium:grid-cols-4 tw:expanded:grid-cols-7"
    >
      {calendarDays(now).map((day) => {
        const onDay = picksOnDay(picks, day);
        const isToday = day.getTime() === today?.getTime();

        return (
          <li
            key={day.getTime()}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'tw:flex tw:min-h-[5rem] tw:flex-col tw:gap-inline tw:rounded-card tw:border-divider tw:border-border tw:p-inset-control',
              isToday && 'tw:border-accent'
            )}
          >
            <time dateTime={day.toISOString()} className="tw:text-label tw:text-fg">
              {unwrapOr(
                format({
                  type: 'date',
                  value: day.toISOString(),
                  options: { weekday: 'short', month: 'short', day: 'numeric' },
                }),
                ''
              )}
            </time>
            {onDay.length === 0 && (
              <span className="tw:text-caption tw:text-fg-muted">
                {tOr('studio.pickDayOpen', {}, '')}
              </span>
            )}
            {onDay.map((pick) => {
              const title = pick.video.title ?? tOr('studio.pickUntitled', {}, '');
              const body = (
                <>
                  <span className="tw:truncate tw:text-label">{title}</span>
                  <span>{windowText(pick)}</span>
                </>
              );

              return onEdit ? (
                <button
                  key={pick.id}
                  type="button"
                  className={cn(
                    CHIP,
                    'tw:cursor-pointer tw:transition-colors tw:duration-fast tw:hover:bg-tint-strong tw:focus-ring tw:motion-reduce:transition-none'
                  )}
                  aria-label={tOr('studio.pickChip', { title, window: windowText(pick) }, '')}
                  onClick={() => onEdit(pick)}
                >
                  {body}
                </button>
              ) : (
                <div key={pick.id} className={CHIP}>
                  {body}
                </div>
              );
            })}
          </li>
        );
      })}
    </ol>
  );
}
