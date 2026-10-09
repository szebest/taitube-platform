import { lexicalScore, searchTokens, wordSimilarity } from '../search-text';

describe('adapters/in-memory: search text', () => {
  it.each([
    ['Learn JavaScript, in 1 hour!', ['learn', 'javascript', 'in', '1', 'hour']],
    ['fire_ship', ['fire', 'ship']],
    ['Żółć gęślą', ['żółć', 'gęślą']],
    ['!!!', []],
  ])('splits %j into %j', (text, tokens) => {
    expect(searchTokens(text)).toEqual(tokens);
  });

  it.each([
    { query: 'react', expected: 1 },
    { query: 'hooks', expected: 0.4 },
    { query: 'react hooks', expected: 1.4 },
    { query: 'react vue', expected: 0 },
  ])('scores $query by the heaviest field holding each word: $expected', ({ query, expected }) => {
    const fields = [
      { text: 'React basics', weight: 'A' },
      { text: 'hooks state', weight: 'B' },
      { text: 'react again', weight: 'D' },
    ] as const;

    expect(lexicalScore(query, fields)).toBeCloseTo(expected);
  });

  it.each([
    { query: 'javascrip', text: 'Learn JavaScript', expected: 0.9 },
    { query: 'javascript', text: 'Learn JavaScript', expected: 1 },
    { query: 'linsu', text: 'Linus Tech Tips', expected: 0.5 },
    { query: 'zzz', text: 'Learn JavaScript', expected: 0 },
    { query: '!!!', text: 'anything', expected: 0 },
  ])('finds $expected of $query in $text', ({ query, text, expected }) => {
    expect(wordSimilarity(query, text)).toBeCloseTo(expected);
  });
});
