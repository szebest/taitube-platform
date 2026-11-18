import { formatInstant } from '../format-instant';
import { contextFor } from './fixtures';

const ISO = '2026-09-22T23:30:00.000Z';

describe('@vp/intl: formatInstant', () => {
  it.each([
    { timeZone: 'UTC', expected: '22/09/2026' },
    { timeZone: 'Europe/Stockholm', expected: '23/09/2026' },
    { timeZone: 'America/New_York', expected: '22/09/2026' },
  ])('reads the instant on the $timeZone wall clock', ({ timeZone, expected }) => {
    const rendered = formatInstant(
      'date',
      ISO,
      { dateStyle: 'short' },
      contextFor('en-GB', { timeZone })
    );

    expect(rendered).toEqual({ ok: true, value: expected });
  });

  it('names the formatter when the value is not an instant', () => {
    expect(formatInstant('time', 'noon', {}, contextFor('en'))).toMatchObject({
      ok: false,
      error: { formatter: 'time' },
    });
  });
});
