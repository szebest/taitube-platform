import { NOW, contextFor } from '../../__tests__/fixtures';
import { calendarDay } from '../calendar-day';

function render(locale: string, value: string, timeZone = 'UTC') {
  const rendered = calendarDay({ type: 'calendarDay', value }, contextFor(locale, { timeZone }));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: calendarDay', () => {
  it.each([
    { locale: 'en-GB', value: '2026-09-22T09:15:00.000Z', expected: /^today 09:15$/ },
    { locale: 'en-GB', value: '2026-09-21T23:59:00.000Z', expected: /^yesterday$/ },
    { locale: 'en-GB', value: '2026-09-23T00:01:00.000Z', expected: /^tomorrow$/ },
    { locale: 'en-GB', value: '2026-09-10T09:15:00.000Z', expected: /^10 Sept? 2026$/ },
    { locale: 'de', value: '2026-09-21T12:00:00.000Z', expected: /^gestern$/ },
    { locale: 'ja', value: '2026-09-21T12:00:00.000Z', expected: /^昨日$/ },
  ])('names $value relative to the reference day in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toMatch(expected);
  });

  it('counts calendar days on the context wall clock, not in UTC', () => {
    const lateEvening = '2026-09-22T09:00:00.000Z';

    expect(render('en-GB', lateEvening, 'Pacific/Kiritimati')).toBe('yesterday');
  });

  it('keeps the reference instant it was given', () => {
    const rendered = calendarDay(
      { type: 'calendarDay', value: NOW, now: '2026-09-23T12:00:00.000Z' },
      contextFor('en')
    );

    expect(rendered).toEqual({ ok: true, value: 'yesterday' });
  });
});
