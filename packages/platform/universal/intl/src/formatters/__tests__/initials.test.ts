import { formatText } from '../../__tests__/fixtures';
import type { InitialsValue } from '../initials';

const FAMILY = '👨‍👩‍👧‍👦';

function initialsOf(name: string, locale = 'en', options?: InitialsValue['options']) {
  return formatText({ type: 'initials', value: name, options }, locale);
}

describe('@kit/intl: initials', () => {
  it.each([
    { scenario: 'two words', name: 'Ada Lovelace', locale: 'en', expected: 'AL' },
    { scenario: 'a lone word', name: 'ada', locale: 'en', expected: 'A' },
    { scenario: 'three words', name: 'Ada King Lovelace', locale: 'en', expected: 'AK' },
    { scenario: 'extra whitespace', name: '  ada \t lovelace ', locale: 'en', expected: 'AL' },
    { scenario: 'a Turkish dotted i', name: 'ilker ışık', locale: 'tr', expected: 'İI' },
    {
      scenario: 'an emoji sequence',
      name: `${FAMILY} Family`,
      locale: 'en',
      expected: `${FAMILY}F`,
    },
    { scenario: 'Polish letters', name: 'łukasz źródło', locale: 'pl', expected: 'ŁŹ' },
  ])('reads $scenario', ({ name, locale, expected }) => {
    expect(initialsOf(name, locale)).toBe(expected);
  });

  it.each([
    { options: { count: 1 }, expected: 'A' },
    { options: { count: 3 }, expected: 'AKL' },
    { options: { count: 0 }, expected: 'FORMAT_UNRENDERABLE' },
    { options: { count: 1.5 }, expected: 'FORMAT_UNRENDERABLE' },
  ] as const)('takes $options', ({ options, expected }) => {
    expect(initialsOf('Ada King Lovelace', 'en', options)).toBe(expected);
  });

  it('declines a name with no letters', () => {
    expect(initialsOf('   ')).toBe('FORMAT_UNRENDERABLE');
  });
});
