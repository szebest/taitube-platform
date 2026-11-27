import { finite, parseCalendarDate, parseInstant } from '../inputs';

describe('@kit/intl: formatter inputs', () => {
  it.each(['2026-09-22T18:30:00.000Z', '2026-09-22T20:30:00+02:00'])(
    'reads %s as an instant',
    (iso) => {
      const parsed = parseInstant('date', iso);

      expect(parsed.ok && parsed.value.toISOString().slice(0, 10)).toBe('2026-09-22');
    }
  );

  it.each(['Sep 22 2026', 'yesterday', '2026-13-45', ''])('declines %j as not ISO 8601', (iso) => {
    expect(parseInstant('date', iso)).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNRENDERABLE', formatter: 'date' },
    });
  });

  it('declines a calendar date as an instant, naming plainDate', () => {
    expect(parseInstant('date', '2024-05-01')).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNRENDERABLE', reason: expect.stringContaining('plainDate') },
    });
  });

  it.each([
    { text: '2024-05-01', expected: true },
    { text: '2024-02-30', expected: false },
    { text: '2024-05-01T00:00:00Z', expected: false },
  ])('reads $text as a calendar date: $expected', ({ text, expected }) => {
    expect(parseCalendarDate('plainDate', text).ok).toBe(expected);
  });

  it.each([0, -3.5, 1e21])('accepts the finite %d', (value) => {
    expect(finite('number', value)).toEqual({ ok: true, value });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('declines %d', (value) => {
    expect(finite('number', value)).toMatchObject({ ok: false, error: { formatter: 'number' } });
  });
});
