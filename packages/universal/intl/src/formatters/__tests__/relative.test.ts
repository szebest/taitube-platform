import { ARABIC_INDIC_DIGIT, NOW, contextFor } from '../../__tests__/fixtures';
import { largestUnit, relative } from '../relative';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(ms: number): string {
  return new Date(Date.parse(NOW) - ms).toISOString();
}

function render(locale: string, value: string, now?: string, context = contextFor(locale)) {
  const rendered = relative({ type: 'relative', value, now }, context);
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: relative', () => {
  it.each([
    { locale: 'en', value: ago(3 * DAY), expected: '3 days ago' },
    { locale: 'en', value: ago(-2 * HOUR), expected: 'in 2 hours' },
    { locale: 'en', value: ago(DAY), expected: 'yesterday' },
    { locale: 'en', value: ago(10_000), expected: '10 seconds ago' },
    { locale: 'en', value: ago(400 * DAY), expected: 'last year' },
    { locale: 'de', value: ago(3 * DAY), expected: 'vor 3 Tagen' },
    { locale: 'ja', value: ago(3 * DAY), expected: '3 日前' },
  ])('picks the unit for $value in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toBe(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', ago(3 * DAY))).toMatch(ARABIC_INDIC_DIGIT);
  });

  it("measures from the value's own reference instant over the context's", () => {
    const later = new Date(Date.parse(NOW) + 2 * DAY).toISOString();

    expect(render('en', NOW, later)).toBe('2 days ago');
  });

  it('declines when neither the value nor the context says when now is', () => {
    expect(render('en', NOW, undefined, contextFor('en', { now: undefined }))).toBe(
      'FORMAT_UNRENDERABLE'
    );
  });

  it.each([
    { seconds: 0, unit: 'second' },
    { seconds: -59, unit: 'second' },
    { seconds: 60, unit: 'minute' },
    { seconds: 90_000, unit: 'day' },
    { seconds: -700_000, unit: 'week' },
    { seconds: 40_000_000, unit: 'year' },
  ])('reads $seconds seconds in $unit', ({ seconds, unit }) => {
    expect(largestUnit(seconds).unit).toBe(unit);
  });
});
