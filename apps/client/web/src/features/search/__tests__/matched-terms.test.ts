import { matchedTerms, splitOnTerms } from '../matched-terms';

describe('apps/client/web: matched terms', () => {
  it.each([
    { query: 'react hooks', terms: ['react', 'hooks'] },
    { query: 'React REACT', terms: ['react'] },
    { query: '"lo fi" beats -rain', terms: ['beats', 'lo', 'fi'] },
    { query: 'cats or dogs', terms: ['cats', 'dogs'] },
    { query: 'c++ (tips)', terms: ['tips', 'c'] },
    { query: '', terms: [] },
  ])('reads the words of "$query" that narrow a search', ({ query, terms }) => {
    expect(matchedTerms(query)).toEqual(expect.arrayContaining(terms));
    expect(matchedTerms(query)).toHaveLength(terms.length);
  });

  it('puts the longest term first, so a longer word wins over its own prefix', () => {
    expect(matchedTerms('re react')).toEqual(['react', 're']);
  });

  it.each([
    {
      scenario: 'every match, whatever its case',
      text: 'React and react',
      terms: ['react'],
      parts: [
        { text: 'React', matched: true, start: 0 },
        { text: ' and ', matched: false, start: 5 },
        { text: 'react', matched: true, start: 10 },
      ],
    },
    {
      scenario: 'text with no term in it',
      text: 'Nothing here',
      terms: ['react'],
      parts: [{ text: 'Nothing here', matched: false, start: 0 }],
    },
    {
      scenario: 'no terms',
      text: 'Anything',
      terms: [],
      parts: [{ text: 'Anything', matched: false, start: 0 }],
    },
    {
      scenario: 'a term made of regular expression syntax, taken literally',
      text: 'a.b and axb',
      terms: ['a.b'],
      parts: [
        { text: 'a.b', matched: true, start: 0 },
        { text: ' and axb', matched: false, start: 3 },
      ],
    },
    {
      scenario: 'markup, left as text',
      text: '<b>react</b>',
      terms: ['react'],
      parts: [
        { text: '<b>', matched: false, start: 0 },
        { text: 'react', matched: true, start: 3 },
        { text: '</b>', matched: false, start: 8 },
      ],
    },
  ])('splits $scenario', ({ text, terms, parts }) => {
    expect(splitOnTerms(text, terms)).toEqual(parts);
  });
});
