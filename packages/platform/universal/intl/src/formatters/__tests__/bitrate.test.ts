import { formatText, ARABIC_INDIC_DIGIT, contextFor, format } from '../../__tests__/fixtures';

function render(locale: string, value: number) {
  const rendered = format({ type: 'bitrate', value }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@kit/intl: bitrate', () => {
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

  it.each([
    { options: { minUnit: 'kilobit-per-second' }, value: 500, expected: '0.5 kb/s' },
    { options: { minimumFractionDigits: 2 }, value: 4_500_000, expected: '4.50 Mb/s' },
    { options: { roundingMode: 'floor' }, value: 4_990_000, expected: '4.9 Mb/s' },
  ] as const)('takes $options', ({ options, value, expected }) => {
    expect(formatText({ type: 'bitrate', value, options })).toBe(expected);
  });
});
