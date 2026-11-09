import { useFormat, useT } from '@vp/intl-react';
import { unwrapOr } from '@vp/result';
import { cn } from '@vp/ui';
import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { usePickWindowText } from '#app/features/admin/hooks/use-pick-window-text';
import { calendarDays, picksOnDay } from '#app/features/admin/utils/pick-days';

export interface PickCalendarProps {
  picks: readonly AdminPick[];
  /** The first day shown, and the instant "running now" is judged against. */
  now: Date;
  /** Only given to someone who may manage picks; without it a chip is plain text. */
  onEdit?: (pick: AdminPick) => void;
}

const CHIP =
  'flex w-full flex-col gap-0.5 rounded-control border-0 bg-accent-soft px-inset-control py-inline text-start text-caption text-accent-ink';

/** The next 30 days as a grid of days; a pick sits on every day its window touches. */
export function PickCalendar({ picks, now, onEdit }: PickCalendarProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const windowText = usePickWindowText();
  const today = calendarDays(now, 1)[0];

  return (
    <ol
      aria-label={tOr('studio.pickCalendar', {}, '')}
      className="m-0 grid list-none grid-cols-2 gap-inline p-0 medium:grid-cols-4 expanded:grid-cols-7"
    >
      {calendarDays(now).map((day) => {
        const onDay = picksOnDay(picks, day);
        const isToday = day.getTime() === today?.getTime();

        return (
          <li
            key={day.getTime()}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'flex min-h-[5rem] flex-col gap-inline rounded-card border-divider border-border p-inset-control',
              isToday && 'border-accent'
            )}
          >
            <time dateTime={day.toISOString()} className="text-label text-fg">
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
              <span className="text-caption text-fg-muted">
                {tOr('studio.pickDayOpen', {}, '')}
              </span>
            )}
            {onDay.map((pick) => {
              const title = pick.video.title ?? tOr('studio.pickUntitled', {}, '');
              const body = (
                <>
                  <span className="truncate text-label">{title}</span>
                  <span>{windowText(pick)}</span>
                </>
              );

              return onEdit ? (
                <button
                  key={pick.id}
                  type="button"
                  className={cn(
                    CHIP,
                    'cursor-pointer transition-colors duration-fast hover:bg-tint-strong focus-ring motion-reduce:transition-none'
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
