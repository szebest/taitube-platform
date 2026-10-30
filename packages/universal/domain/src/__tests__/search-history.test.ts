import { searchHistoryText } from '../search-history';

describe('@vp/domain: search history', () => {
  it.each([
    { scenario: 'plain text', raw: 'lofi beats', query: 'lofi beats', queryKey: 'lofi beats' },
    { scenario: 'other casing', raw: 'LoFi Beats', query: 'LoFi Beats', queryKey: 'lofi beats' },
    {
      scenario: 'outer spaces',
      raw: '  lofi beats \t',
      query: 'lofi beats',
      queryKey: 'lofi beats',
    },
    {
      scenario: 'inner spaces',
      raw: 'lofi \n  beats',
      query: 'lofi beats',
      queryKey: 'lofi beats',
    },
    {
      scenario: 'a very long text',
      raw: 'Word '.repeat(60),
      query: 'Word '.repeat(60).trim(),
      queryKey: 'word '.repeat(60).trim(),
    },
  ])('reads $scenario as one key', ({ raw, query, queryKey }) => {
    expect(searchHistoryText(raw)).toEqual({ query, queryKey });
  });
});
