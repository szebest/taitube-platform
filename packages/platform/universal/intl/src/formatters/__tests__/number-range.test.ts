import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { numberRange } from '../number-range';

function render(locale: string, value: readonly [number, number]) {
  const rendered = numberRange({ type: 'numberRange', value }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: numberRange', () => {
  it.each([
    { locale: 'en', value: [1, 5] as const, expected: /^1\s?[–-]\s?5$/u },
    { locale: 'de', value: [1500, 2500] as const, expected: /^1\.500\s?[–-]\s?2\.500$/u },
    { locale: 'ja', value: [1, 5] as const, expected: /^1\s?[～~–-]\s?5$/u },
  ])('spans $value in $locale, start before end', ({ locale, value, expected }) => {
    expect(render(locale, value)).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', [1, 5])).toMatch(ARABIC_INDIC_DIGIT);
  });

  it('declines a bound that is not finite', () => {
    expect(render('en', [1, Number.NaN])).toBe('FORMAT_UNRENDERABLE');
  });
});
