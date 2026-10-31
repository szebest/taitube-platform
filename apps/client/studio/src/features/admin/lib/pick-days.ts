import type { AdminPick } from '#app/features/admin/api/admin-picks';

const CALENDAR_DAYS = 30;

const nextDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);

/** Midnight of each of the `count` local days starting with the one holding `from`. */
export function calendarDays(from: Date, count = CALENDAR_DAYS): Date[] {
  const days = [new Date(from.getFullYear(), from.getMonth(), from.getDate())];
  while (days.length < count) {
    days.push(nextDay(days[days.length - 1] ?? from));
  }
  return days;
}

/** The picks whose window touches the local day starting at `day`. */
export function picksOnDay(picks: readonly AdminPick[], day: Date): AdminPick[] {
  const end = nextDay(day).getTime();
  return picks.filter(
    (pick) =>
      new Date(pick.startsAt).getTime() < end && new Date(pick.endsAt).getTime() > day.getTime()
  );
}
