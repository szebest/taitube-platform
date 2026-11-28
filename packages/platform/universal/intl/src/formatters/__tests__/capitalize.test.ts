import { formatText } from '../../__tests__/fixtures';

describe('@kit/intl: capitalize', () => {
  it.each([
    { text: 'xlarge', locale: 'en', expected: 'Xlarge' },
    { text: 'already Fine', locale: 'en', expected: 'Already Fine' },
    { text: 'ışık', locale: 'tr', expected: 'Işık' },
    { text: 'iyi', locale: 'tr', expected: 'İyi' },
    { text: '', locale: 'en', expected: '' },
  ])('turns $text into $expected in $locale', ({ text, locale, expected }) => {
    expect(formatText({ type: 'capitalize', value: text }, locale)).toBe(expected);
  });

  it('declines an option, it takes none', () => {
    expect(
      // @ts-expect-error capitalize has no options
      formatText({ type: 'capitalize', value: 'a', options: { style: 'long' } })
    ).toBe('FORMAT_UNKNOWN_OPTION');
  });
});
