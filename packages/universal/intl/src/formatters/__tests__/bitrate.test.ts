import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { bitrate } from '../bitrate';

function render(locale: string, value: number) {
  const rendered = bitrate({ type: 'bitrate', value }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: bitrate', () => {
  it.each([
    { locale: 'en', value: 4_500_000, expected: /^4\.5 Mb\/s$/ },
    { locale: 'en', value: 800, expected: /^800 bit\/s$/ },
    { locale: 'de', value: 4_500_000, expected: /^4,5 Mb\/(s|Sek\.)$/ },
  ])('scales $value in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value)).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(render('ar-EG', 4_500_000)).toMatch(ARABIC_INDIC_DIGIT);
  });
});
