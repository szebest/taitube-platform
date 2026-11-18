import { ARABIC_INDIC_DIGIT, ASCII_DIGIT, contextFor } from '../../__tests__/fixtures';
import { compact } from '../compact';

function render(locale: string, value: number) {
  const rendered = compact({ type: 'count', value }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: compact', () => {
  it.each([
    { locale: 'en', value: 1_234_567, expected: /^1\.2M$/ },
    { locale: 'en', value: 12_345, expected: /^12K$/ },
    { locale: 'en', value: 999, expected: /^999$/ },
    { locale: 'de', value: 1_234_567, expected: /^1,2\sMio\.$/u },
    { locale: 'ja', value: 12_345, expected: /^1\.2万$/ },
  ])('shortens $value in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', 1_234_567)).toMatch(ARABIC_INDIC_DIGIT);
    expect(render('ar-EG', 1_234_567)).not.toMatch(ASCII_DIGIT);
  });

  it('declines an unsupported locale', () => {
    expect(render('xx', 10)).toBe('FORMAT_UNSUPPORTED_LOCALE');
  });
});
