import { contextFor } from '../../__tests__/fixtures';
import { createIntl } from '../../create-intl';

const WORDS = ['Zebra', 'Ärger', 'apple', 'Öl'];

function sortedIn(locale: string): string[] {
  const compare = createIntl(contextFor(locale)).call('collator', undefined);
  return compare.ok ? [...WORDS].sort(compare.value) : [];
}

describe('@kit/intl: collator', () => {
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
    const compare = createIntl(contextFor('en')).call('collator', undefined, { numeric: true });

    expect(compare.ok && ['ep10', 'ep9', 'ep1'].sort(compare.value)).toEqual([
      'ep1',
      'ep9',
      'ep10',
    ]);
  });

  it('declines an option it does not allow', () => {
    const intl = createIntl(contextFor('en'));

    // @ts-expect-error usage is fixed to sorting
    expect(intl.call('collator', undefined, { usage: 'search' })).toMatchObject({
      ok: false,
      error: { code: 'FORMAT_UNKNOWN_OPTION', option: 'usage' },
    });
  });
});
