import { formatText, ARABIC_INDIC_DIGIT, contextFor, format } from '../../__tests__/fixtures';

function render(locale: string, value: readonly [number, number]) {
  const rendered = format({ type: 'numberRange', value }, contextFor(locale));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@kit/intl: numberRange', () => {
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

  it.each([
    {
      scenario: 'a price range keeps its currency once',
      value: [
        { type: 'money', value: 5, options: { currency: 'USD' } },
        { type: 'money', value: 10, options: { currency: 'USD' } },
      ],
      expected: '$5.00 – $10.00',
    },
    {
      scenario: 'ends of different kinds',
      value: [
        { type: 'money', value: 5, options: { currency: 'USD' } },
        { type: 'percent', value: 10 },
      ],
      expected: 'FORMAT_UNRENDERABLE',
    },
    {
      scenario: 'ends in different currencies',
      value: [
        { type: 'money', value: 5, options: { currency: 'USD' } },
        { type: 'money', value: 10, options: { currency: 'EUR' } },
      ],
      expected: 'FORMAT_UNRENDERABLE',
    },
  ] as const)('spans $scenario', ({ value, expected }) => {
    expect(formatText({ type: 'numberRange', value }, 'en-US').replace(/\s/gu, ' ')).toBe(expected);
  });
});
