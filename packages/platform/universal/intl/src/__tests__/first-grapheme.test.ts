import { upperFirstGrapheme } from '../first-grapheme';
import { contextFor } from './fixtures';

const FAMILY = '👨‍👩‍👧‍👦';

describe('@kit/intl: upperFirstGrapheme', () => {
  it.each([
    { scenario: 'a plain word', locale: 'en', text: 'xlarge', expected: ['X', 'large'] },
    { scenario: 'a dotted i in Turkish', locale: 'tr', text: 'ilker', expected: ['İ', 'lker'] },
    { scenario: 'a dotless i elsewhere', locale: 'en', text: 'ilker', expected: ['I', 'lker'] },
    { scenario: 'an emoji sequence', locale: 'en', text: `${FAMILY}x`, expected: [FAMILY, 'x'] },
    {
      scenario: 'a letter with a combining mark',
      locale: 'en',
      text: 'école',
      expected: ['É', 'cole'],
    },
    { scenario: 'empty text', locale: 'en', text: '', expected: ['', ''] },
  ])('splits $scenario', ({ locale, text, expected }) => {
    const split = upperFirstGrapheme(text, contextFor(locale));

    expect(split.ok && [split.value.first, split.value.rest]).toEqual(expected);
  });

  it('declines in a locale no engine knows', () => {
    expect(upperFirstGrapheme('a', contextFor('xx'))).toMatchObject({ ok: false });
  });
});
