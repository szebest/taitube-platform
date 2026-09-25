import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { type BytesOptions, bytes, scale } from '../bytes';

function render(locale: string, value: number, options?: BytesOptions) {
  const rendered = bytes({ type: 'bytes', value, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: bytes', () => {
  it.each([
    { locale: 'en', value: 4_500_000, expected: /^4\.5 MB$/ },
    { locale: 'en', value: 1_200_000_000, expected: /^1\.2 GB$/ },
    { locale: 'en', value: 512, expected: /^512 byte$/ },
    { locale: 'de', value: 4_500_000, expected: /^4,5 MB$/ },
    { locale: 'en', value: 5 * 1024 ** 3, expected: /^5\.4 GB$/ },
  ])('scales $value decimally in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toMatch(expected);
  });

  it('scales by 1024 on the binary base', () => {
    expect(render('en', 5 * 1024 ** 3, { base: 'binary' })).toMatch(/^5 GB$/);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', 4_500_000)).toMatch(ARABIC_INDIC_DIGIT);
  });

  it.each([
    { value: 999, expected: { amount: 999, unit: 'a' } },
    { value: 1500, expected: { amount: 1.5, unit: 'b' } },
    { value: 5_000_000_000, expected: { amount: 5000, unit: 'c' } },
    { value: -2000, expected: { amount: -2, unit: 'b' } },
  ])(
    'scales $value to the largest unit it reaches, the last one capping it',
    ({ value, expected }) => {
      expect(scale(value, 1000, ['a', 'b', 'c'])).toEqual(expected);
    }
  );
});
