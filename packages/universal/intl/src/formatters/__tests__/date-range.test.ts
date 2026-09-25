import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { dateRange } from '../date-range';

const RANGE = ['2026-09-22T12:00:00.000Z', '2026-09-24T12:00:00.000Z'] as const;

function render(locale: string, value: readonly [string, string] = RANGE) {
  const rendered = dateRange(
    { type: 'dateRange', value, options: { day: 'numeric', month: 'short' } },
    contextFor(locale)
  );
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: dateRange', () => {
  it.each([
    { locale: 'en-GB', expected: /^22\s?[–-]\s?24 Sept?$/u },
    { locale: 'de', expected: /^22\.\s?[–-]\s?24\. Sept\.$/u },
    { locale: 'ja', expected: /^0?9\/22\s?[～~–-]\s?0?9\/24$/u },
  ])('orders the range start to end in $locale', ({ locale, expected }) => {
    expect(render(locale)).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG')).toMatch(ARABIC_INDIC_DIGIT);
  });

  it('declines a bound that is not ISO 8601', () => {
    expect(render('en', [RANGE[0], 'soon'])).toBe('FORMAT_UNRENDERABLE');
  });
});
