import type { Notification } from '@vp/api-contracts';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface NotificationDay {
  /** The calendar day as `dayOf` writes it, which is also the heading of an earlier day. */
  day: string;
  when: 'today' | 'yesterday' | 'earlier';
  items: Notification[];
}

/**
 * Folds a newest-first list into one group per calendar day. `dayOf` names an instant's day in the
 * viewer's zone, so two instants share a group exactly when it names them the same.
 */
export function groupByDay(
  items: readonly Notification[],
  dayOf: (instant: string) => string,
  now: string | undefined
): NotificationDay[] {
  const today = now && dayOf(now);
  const yesterday = now && dayOf(new Date(Date.parse(now) - DAY_MS).toISOString());
  const days: NotificationDay[] = [];

  for (const item of items) {
    const day = dayOf(item.createdAt);
    const last = days.at(-1);
    if (last?.day === day) {
      last.items.push(item);
      continue;
    }
    const when = day === today ? 'today' : day === yesterday ? 'yesterday' : 'earlier';
    days.push({ day, when, items: [item] });
  }
  return days;
}
