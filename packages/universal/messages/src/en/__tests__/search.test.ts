import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en search', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'search.resultsFor', expected: 'Results for lofi' },
    { key: 'search.noResults', expected: 'No videos match lofi' },
    { key: 'search.noQuery', expected: 'Type a word to search for' },
  ] as const)('renders $key', ({ key, expected }) => {
    expect(t(key, { query: 'lofi' })).toEqual({ ok: true, value: expected });
  });
});
