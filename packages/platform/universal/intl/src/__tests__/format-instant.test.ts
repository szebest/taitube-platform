import { DATE_RESOLUTION, formatInstant, resolveDateOptions } from '../format-instant';
import { contextFor } from './fixtures';

const ISO = '2026-09-22T23:30:00.000Z';

describe('@kit/intl: formatInstant', () => {
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

  it.each([
    { options: {}, expected: { dateStyle: 'medium' } },
    { options: { style: 'long' } as const, expected: { dateStyle: 'long' } },
    { options: { year: 'numeric' } as const, expected: { year: 'numeric' } },
  ])('resolves $options to Intl options', ({ options, expected }) => {
    expect(resolveDateOptions(options, DATE_RESOLUTION)).toEqual(expected);
  });

  it('lays a style over defaults that name more than it', () => {
    const resolution = {
      styleKey: 'dateStyle',
      defaults: { dateStyle: 'medium', timeStyle: 'short' },
    } as const;

    expect(resolveDateOptions({ style: 'full' }, resolution)).toEqual({
      dateStyle: 'full',
      timeStyle: 'short',
    });
  });

  it.each(['date', 'time', 'dateTime'])('declines a calendar date as %s', (formatter) => {
    expect(formatInstant(formatter, '2024-05-01', {}, contextFor('en'))).toMatchObject({
      ok: false,
      error: { formatter, reason: expect.stringContaining('plainDate') },
    });
  });
});
