import { contextFor } from '../../__tests__/fixtures';
import { parseDecimal } from '../parse-decimal';

function parse(text: string, locale: string) {
  const parsed = parseDecimal(text, contextFor(locale));
  return parsed.ok ? parsed.value : parsed.error.code;
}

describe('@kit/intl: parseDecimal', () => {
  it.each([
    { text: '1 234,5', locale: 'pl', expected: 1234.5 },
    { text: '1 234,5', locale: 'pl', expected: 1234.5 },
    { text: '1,234.5', locale: 'en', expected: 1234.5 },
    { text: '1.234,5', locale: 'de', expected: 1234.5 },
    { text: '1234,5', locale: 'de', expected: 1234.5 },
    { text: '1.234', locale: 'es', expected: 1234 },
    { text: '1 234 567,89', locale: 'fr', expected: 1234567.89 },
    { text: '12,34,567.5', locale: 'en-IN', expected: 1234567.5 },
    { text: '١٢٣٤٫٥', locale: 'ar-EG', expected: 1234.5 },
    { text: '1234٫5', locale: 'ar-EG', expected: 1234.5 },
    { text: '-12.5', locale: 'en', expected: -12.5 },
    { text: '−12,5', locale: 'sv', expected: -12.5 },
    { text: '.5', locale: 'en', expected: 0.5 },
    { text: '  42  ', locale: 'en', expected: 42 },
    { text: '1๒๓๔', locale: 'en-u-nu-thai', expected: 1234 },
  ])('reads $text in $locale as $expected', ({ text, locale, expected }) => {
    expect(parse(text, locale)).toBe(expected);
  });

  it.each([
    { scenario: 'grouping the locale does not use', text: '12,3,4', locale: 'en' },
    { scenario: 'a group after the decimal', text: '1.5,5', locale: 'en' },
    { scenario: 'the other locale separators', text: '1,234.5', locale: 'pl' },
    { scenario: 'two decimals', text: '1.2.3', locale: 'en' },
    { scenario: 'letters', text: '12abc', locale: 'en' },
    { scenario: 'a currency symbol', text: '$12', locale: 'en' },
    { scenario: 'no digits', text: ',', locale: 'pl' },
    { scenario: 'empty text', text: '', locale: 'en' },
  ])('declines $scenario', ({ text, locale }) => {
    expect(parse(text, locale)).toBe('FORMAT_UNRENDERABLE');
  });

  it('declines in a locale no engine knows', () => {
    expect(parse('1', 'xx')).toBe('FORMAT_UNSUPPORTED_LOCALE');
  });
});
