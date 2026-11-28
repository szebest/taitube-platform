import { formatText } from '../../__tests__/fixtures';
import type { TimeZoneValue } from '../time-zone';

const SUMMER = '2026-07-01T12:00:00.000Z';
const WINTER = '2026-01-15T12:00:00.000Z';

function zoneName(zone: string, locale: string, options?: TimeZoneValue['options']) {
  return formatText({ type: 'timeZone', value: zone, options }, locale);
}

describe('@kit/intl: timeZone', () => {
  it.each([
    { style: 'long', at: SUMMER, expected: 'Central European Summer Time' },
    { style: 'long', at: WINTER, expected: 'Central European Standard Time' },
    { style: 'short', at: SUMMER, expected: 'GMT+2' },
    { style: 'offset', at: SUMMER, expected: 'GMT+2' },
    { style: 'offset', at: WINTER, expected: 'GMT+1' },
  ] as const)('names Berlin as $style at $at', ({ style, at, expected }) => {
    expect(zoneName('Europe/Berlin', 'en', { style, at })).toBe(expected);
  });

  it.each([
    { locale: 'de', expected: 'Mitteleuropäische Sommerzeit' },
    { locale: 'pl', expected: 'czas środkowoeuropejski letni' },
  ])('names it in $locale', ({ locale, expected }) => {
    expect(zoneName('Europe/Berlin', locale, { at: SUMMER })).toBe(expected);
  });

  it('reads the instant from the context when the value names none', () => {
    expect(zoneName('Europe/Berlin', 'en', { style: 'offset' })).toBe('GMT+2');
  });

  it('names the viewer own zone for USER', () => {
    const viewer = formatText(
      { type: 'timeZone', value: 'user', options: { style: 'offset', at: SUMMER } },
      'en',
      { timeZone: 'Asia/Tokyo' }
    );

    expect(viewer).toBe('GMT+9');
  });

  it.each([
    { scenario: 'a zone no engine knows', zone: 'Mars/Olympus', options: { at: SUMMER } },
    { scenario: 'an instant that is not ISO', zone: 'UTC', options: { at: 'noon' } },
  ])('declines $scenario', ({ zone, options }) => {
    expect(zoneName(zone, 'en', options)).toBe('FORMAT_UNRENDERABLE');
  });
});
