import { ARABIC_INDIC_DIGIT, contextFor, format } from '../../__tests__/fixtures';
import { type BytesValue } from '../bytes';

function render(locale: string, value: number, options?: BytesValue['options']) {
  const rendered = format({ type: 'bytes', value, options }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@kit/intl: bytes', () => {
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
});
