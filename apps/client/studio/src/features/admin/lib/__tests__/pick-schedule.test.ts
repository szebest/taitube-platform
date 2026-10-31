import type { AdminPick } from '#app/features/admin/api/admin-picks';
import { defaultWindow, fromLocalInput, toLocalInput, windowIssue } from '../pick-schedule';

const NOW = new Date(2026, 9, 31, 12, 0);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0);
const local = (day: number, hour: number) => toLocalInput(at(day, hour).toISOString());

const held = (startsAt: Date, endsAt: Date, id = 'held'): AdminPick =>
  ({ id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }) as AdminPick;

const HELD = held(at(2, 9), at(3, 9));

describe('apps/client/studio: pick schedule', () => {
  it('reads an instant back from the input value it wrote, to the minute', () => {
    const iso = at(2, 9).toISOString();

    expect(fromLocalInput(toLocalInput(iso))?.toISOString()).toBe(iso);
  });

  it.each(['', 'not a date'])('reads %j as no instant', (value) => {
    expect(fromLocalInput(value)).toBeUndefined();
  });

  it('offers tomorrow, midnight to midnight, in the browser zone', () => {
    expect(defaultWindow(NOW)).toEqual({
      startsAt: toLocalInput(new Date(2026, 10, 1).toISOString()),
      endsAt: toLocalInput(new Date(2026, 10, 2).toISOString()),
    });
  });

  it.each([
    {
      name: 'a free window',
      startsAt: local(3, 9),
      endsAt: local(4, 9),
      exceptId: undefined,
      issue: undefined,
    },
    {
      name: 'one that starts where another ends',
      startsAt: local(3, 9),
      endsAt: local(3, 12),
      exceptId: undefined,
      issue: undefined,
    },
    {
      name: 'the window of the pick being edited',
      startsAt: local(2, 9),
      endsAt: local(3, 9),
      exceptId: 'held',
      issue: undefined,
    },
    {
      name: 'no start',
      startsAt: '',
      endsAt: local(4, 9),
      exceptId: undefined,
      issue: { kind: 'incomplete' },
    },
    {
      name: 'a window that ends before it starts',
      startsAt: local(4, 9),
      endsAt: local(3, 9),
      exceptId: undefined,
      issue: { kind: 'invalid', message: 'A pick must end after it starts' },
    },
    {
      name: 'a window already over',
      startsAt: new Date(2026, 9, 1).toISOString().slice(0, 16),
      endsAt: new Date(2026, 9, 2).toISOString().slice(0, 16),
      exceptId: undefined,
      issue: { kind: 'invalid', message: 'A pick must still be current or in the future' },
    },
    {
      name: 'a window inside another',
      startsAt: local(2, 12),
      endsAt: local(2, 15),
      exceptId: undefined,
      issue: { kind: 'overlap', pick: HELD },
    },
    {
      name: 'a window running into another',
      startsAt: local(1, 9),
      endsAt: local(2, 10),
      exceptId: undefined,
      issue: { kind: 'overlap', pick: HELD },
    },
  ])('finds $name', ({ startsAt, endsAt, exceptId, issue }) => {
    expect(windowIssue({ startsAt, endsAt, picks: [HELD], exceptId, now: NOW })).toEqual(issue);
  });
});
