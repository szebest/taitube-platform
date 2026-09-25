import { ARABIC_INDIC_DIGIT, ASCII_DIGIT, contextFor } from '../../__tests__/fixtures';
import { type PercentOptions, percent } from '../percent';

function render(locale: string, value: number, options?: PercentOptions) {
  const rendered = percent({ type: 'percent', value, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: percent', () => {
  it.each([
    { locale: 'en', value: 7, expected: /^7%$/ },
    { locale: 'en', value: 12.5, expected: /^12\.5%$/ },
    { locale: 'de', value: 12.5, expected: /^12,5\s%$/u },
    { locale: 'fr', value: 7, expected: /^7\s%$/u },
  ])('reads $value as percentage points in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toMatch(expected);
  });

  it('takes the fraction digits it is given', () => {
    expect(render('en', 12.5, { maximumFractionDigits: 0 })).toMatch(/^1[23]%$/);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', 7)).toMatch(ARABIC_INDIC_DIGIT);
    expect(render('ar-EG', 7)).not.toMatch(ASCII_DIGIT);
  });
});
