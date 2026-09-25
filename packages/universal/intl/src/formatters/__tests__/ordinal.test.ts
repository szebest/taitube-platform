import { ASCII_DIGIT, DEVANAGARI_DIGIT, contextFor } from '../../__tests__/fixtures';
import { ordinal } from '../ordinal';

function render(locale: string, value: number) {
  const rendered = ordinal({ type: 'ordinal', value }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: ordinal', () => {
  it.each([
    { locale: 'en', value: 1, expected: '1st' },
    { locale: 'en', value: 2, expected: '2nd' },
    { locale: 'en', value: 3, expected: '3rd' },
    { locale: 'en', value: 11, expected: '11th' },
    { locale: 'en', value: 21, expected: '21st' },
    { locale: 'en-GB', value: 112, expected: '112th' },
    { locale: 'sv', value: 2, expected: '2:a' },
    { locale: 'sv', value: 3, expected: '3:e' },
    { locale: 'de', value: 3, expected: '3.' },
    { locale: 'fr', value: 1, expected: '1er' },
  ])('ranks $value in $locale as $expected', ({ locale, value, expected }) => {
    expect(render(locale, value)).toBe(expected);
  });

  it('writes the number in the locale numbering system', () => {
    const rendered = render('en-u-nu-deva', 3);

    expect(rendered).toMatch(DEVANAGARI_DIGIT);
    expect(rendered).not.toMatch(ASCII_DIGIT);
    expect(rendered.endsWith('rd')).toBe(true);
  });

  it('declines a language it holds no suffixes for, rather than borrowing English', () => {
    expect(render('ja', 3)).toBe('FORMAT_UNRENDERABLE');
  });
});
