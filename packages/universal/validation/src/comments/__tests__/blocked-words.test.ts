import { matchesBlockedWord } from '../blocked-words';

describe('@vp/validation: matchesBlockedWord', () => {
  it.each([
    { scenario: 'the word alone', words: ['spam'], text: 'spam', matches: true },
    { scenario: 'a different case', words: ['spam'], text: 'This is SPAM!', matches: true },
    {
      scenario: 'a word typed in capitals',
      words: ['SPAM'],
      text: 'some spam here',
      matches: true,
    },
    { scenario: 'accents on the text', words: ['cafe'], text: 'Un café noir', matches: true },
    { scenario: 'accents on the word', words: ['café'], text: 'one cafe please', matches: true },
    {
      scenario: 'a phrase over a line break',
      words: ['free money'],
      text: 'free\nmoney now',
      matches: true,
    },
    { scenario: 'a word at the start', words: ['spam'], text: 'spam, spam', matches: true },
    { scenario: 'a word inside another', words: ['ass'], text: 'a classic', matches: false },
    { scenario: 'a word that continues', words: ['spam'], text: 'spammer', matches: false },
    { scenario: 'a word that is a suffix', words: ['spam'], text: 'antispam', matches: false },
    { scenario: 'a digit next to the word', words: ['spam'], text: 'spam2', matches: false },
    { scenario: 'any of several words', words: ['aa', 'bb'], text: 'one bb two', matches: true },
    {
      scenario: 'a regex character in a word',
      words: ['c++'],
      text: 'I like c++ a lot',
      matches: true,
    },
    {
      scenario: 'a regex character that is not in the text',
      words: ['a.c'],
      text: 'abc',
      matches: false,
    },
    { scenario: 'no words', words: [], text: 'anything', matches: false },
  ])('is $matches for $scenario', ({ words, text, matches }) => {
    expect(matchesBlockedWord(words, text)).toBe(matches);
  });
});
