import { contextFor } from '../../__tests__/fixtures';
import { collator } from '../collator';

const WORDS = ['Zebra', 'Ärger', 'apple', 'Öl'];

function sortedIn(locale: string): string[] {
  const compare = collator(contextFor(locale));
  return compare.ok ? [...WORDS].sort(compare.value) : [];
}

describe('@vp/intl: collator', () => {
  it.each([
    { locale: 'de', expected: ['apple', 'Ärger', 'Öl', 'Zebra'] },
    { locale: 'sv', expected: ['apple', 'Zebra', 'Ärger', 'Öl'] },
    { locale: 'en', expected: ['apple', 'Ärger', 'Öl', 'Zebra'] },
  ])('sorts in the order $locale reads an alphabet', ({ locale, expected }) => {
    expect(sortedIn(locale)).toEqual(expected);
  });

  it('disagrees with code-point order, which puts Ä after Z', () => {
    expect([...WORDS].sort()).toEqual(['Zebra', 'apple', 'Ärger', 'Öl']);
    expect(sortedIn('de')).not.toEqual([...WORDS].sort());
  });

  it('compares numerically when asked', () => {
    const compare = collator(contextFor('en'), { numeric: true });

    expect(compare.ok && ['ep10', 'ep9', 'ep1'].sort(compare.value)).toEqual([
      'ep1',
      'ep9',
      'ep10',
    ]);
  });

  it('declines an option it does not allow', () => {
    // @ts-expect-error usage is fixed to sorting
    expect(collator(contextFor('en'), { usage: 'search' })).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNKNOWN_OPTION', option: 'usage' },
    });
  });
});
