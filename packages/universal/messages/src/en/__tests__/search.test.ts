import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en search', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'search.resultsFor', expected: 'Results for lofi' },
    { key: 'search.noResults', expected: 'No videos match lofi' },
  ] as const)('renders $key around the query', ({ key, expected }) => {
    expect(t(key, { query: 'lofi' })).toEqual({ ok: true, value: expected });
  });

  it('asks for a word when there is nothing to search for', () => {
    expect(t('search.noQuery')).toEqual({ ok: true, value: 'Type a word to search for' });
  });
});
