import { contextFor } from '../../__tests__/fixtures';
import { pluralCategory } from '../plural';

function category(locale: string, count: number, type?: Intl.PluralRuleType) {
  const selected = pluralCategory(count, contextFor(locale), type);
  return selected.ok ? selected.value : selected.error.code;
}

describe('@vp/intl: pluralCategory', () => {
  it.each([
    { locale: 'en', count: 1, expected: 'one' },
    { locale: 'en', count: 2, expected: 'other' },
    { locale: 'pl', count: 3, expected: 'few' },
    { locale: 'pl', count: 5, expected: 'many' },
    { locale: 'ar', count: 0, expected: 'zero' },
    { locale: 'ar', count: 2, expected: 'two' },
    { locale: 'ja', count: 1, expected: 'other' },
  ])('files $count under $expected in $locale', ({ locale, count, expected }) => {
    expect(category(locale, count)).toBe(expected);
  });

  it('selects ordinal categories on request', () => {
    expect(category('en', 3, 'ordinal')).toBe('few');
  });

  it('declines a count that is not finite', () => {
    expect(category('en', Number.NaN)).toBe('FORMAT_UNRENDERABLE');
  });
});
