import { formatText, ARABIC_INDIC_DIGIT, contextFor, format } from '../../__tests__/fixtures';
import { USER } from '../../context';
import { type MoneyValue } from '../money';

function render(locale: string, value: MoneyValue, currency?: string) {
  const rendered = format(value, contextFor(locale, { currency }));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@kit/intl: money', () => {
  it.each([
    {
      locale: 'en-GB',
      value: { type: 'money', value: 1250, options: { units: 'minor' } } as const,
      expected: /^£12\.50$/,
    },
    { locale: 'en-GB', value: { type: 'money', value: 12.5 } as const, expected: /^£12\.50$/ },
    {
      locale: 'sv',
      value: { type: 'money', value: 1250, options: { units: 'minor', currency: 'SEK' } } as const,
      expected: /^12,50\skr$/u,
    },
    {
      locale: 'ja',
      value: { type: 'money', value: 1250, options: { units: 'minor', currency: 'JPY' } } as const,
      expected: /^[￥¥]1,250$/u,
    },
  ])('renders $value in $locale', ({ locale, value, expected }) => {
    expect(render(locale, value, 'GBP')).toMatch(expected);
  });

  it('writes Arabic-Indic digits in ar-EG', () => {
    expect(
      render('ar-EG', { type: 'money', value: 12, options: { currency: USER } }, 'EGP')
    ).toMatch(ARABIC_INDIC_DIGIT);
  });

  it.each([
    {
      scenario: 'no currency anywhere',
      currency: undefined,
      value: { type: 'money', value: 1 } as const,
    },
    {
      scenario: 'an unknown currency',
      currency: 'GBP',
      value: { type: 'money', value: 1, options: { currency: 'ZZZ' } } as const,
    },
  ])('declines $scenario', ({ currency, value }) => {
    expect(render('en', value, currency)).toBe('FORMAT_UNRENDERABLE');
  });

  it.each([
    { options: { currencySign: 'accounting' }, value: -5, expected: '($5.00)' },
    { options: { notation: 'compact' }, value: 1_250_000, expected: '$1.3M' },
    { options: { trailingZeroDisplay: 'stripIfInteger' }, value: 5, expected: '$5' },
    {
      options: { units: 'minor' },
      value: 9_007_199_254_740_991,
      expected: '$90,071,992,547,409.91',
    },
    { options: { units: 'minor' }, value: -5, expected: '-$0.05' },
    { options: { units: 'minor' }, value: 12.5, expected: 'FORMAT_UNRENDERABLE' },
  ] as const)('takes $options for $value', ({ options, value, expected }) => {
    expect(formatText({ type: 'money', value, options }, 'en-US', { currency: 'USD' })).toBe(
      expected
    );
  });
});
