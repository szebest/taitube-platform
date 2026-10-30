import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { calendarDays, picksOnDay } from '../pick-days';

const pick = (startsAt: Date, endsAt: Date) =>
  ({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }) as AdminPick;

describe('apps/client/studio: pick days', () => {
  it('lists 30 consecutive local midnights from the day holding the instant', () => {
    const days = calendarDays(new Date(2026, 9, 31, 15, 30));

    expect(days).toHaveLength(30);
    expect(days[0]).toEqual(new Date(2026, 9, 31));
    expect(days[1]).toEqual(new Date(2026, 10, 1));
    expect(days[29]).toEqual(new Date(2026, 10, 29));
  });

  it.each([
    {
      name: 'inside the day',
      window: pick(new Date(2026, 10, 1, 9), new Date(2026, 10, 1, 18)),
      on: true,
    },
    {
      name: 'running through it',
      window: pick(new Date(2026, 9, 31, 9), new Date(2026, 10, 2, 9)),
      on: true,
    },
    {
      name: 'ending at its start',
      window: pick(new Date(2026, 9, 31, 9), new Date(2026, 10, 1)),
      on: false,
    },
    {
      name: 'starting at its end',
      window: pick(new Date(2026, 10, 2), new Date(2026, 10, 3)),
      on: false,
    },
  ])('puts a pick $name on the day: $on', ({ window, on }) => {
    expect(picksOnDay([window], new Date(2026, 10, 1))).toEqual(on ? [window] : []);
  });
});
