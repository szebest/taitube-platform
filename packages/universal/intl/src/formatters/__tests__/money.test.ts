import { ARABIC_INDIC_DIGIT, contextFor } from '../../__tests__/fixtures';
import { USER } from '../../context';
import { type MoneyValue, money } from '../money';

function render(locale: string, value: MoneyValue, currency?: string) {
  const rendered = money(value, contextFor(locale, { currency }));
  return rendered.ok ? rendered.value : rendered.error.code;
}

describe('@vp/intl: money', () => {
  it.each([
    {
      locale: 'en-GB',
      value: { type: 'money', value: 1250, units: 'minor' } as const,
      expected: /^£12\.50$/,
    },
    { locale: 'en-GB', value: { type: 'money', value: 12.5 } as const, expected: /^£12\.50$/ },
    {
      locale: 'sv',
      value: { type: 'money', value: 1250, units: 'minor', options: { currency: 'SEK' } } as const,
      expected: /^12,50\skr$/u,
    },
    {
      locale: 'ja',
      value: { type: 'money', value: 1250, units: 'minor', options: { currency: 'JPY' } } as const,
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
});
