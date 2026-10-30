import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en search', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'search.resultsFor', expected: 'Results for lofi' },
    { key: 'search.noResults', expected: 'Nothing matches lofi' },
    { key: 'search.searchFor', expected: 'Search for lofi' },
    { key: 'search.fuzzyTitle', expected: 'No exact matches for lofi' },
    { key: 'search.removeRecent', expected: 'Remove lofi from recent searches' },
  ] as const)('renders $key', ({ key, expected }) => {
    expect(t(key, { query: 'lofi' })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { key: 'search.noQuery', expected: 'Type a word to search for' },
    {
      key: 'search.noResultsHint',
      expected: 'Check the spelling, or start from one of these topics.',
    },
    { key: 'search.fuzzyBody', expected: 'These are the closest matches instead.' },
    { key: 'search.topicsLabel', expected: 'Suggested topics' },
    { key: 'search.viewChannel', expected: 'View channel' },
    { key: 'search.filterLabel', expected: 'Result type' },
    { key: 'search.sortLabel', expected: 'Sort by' },
    { key: 'search.suggestionsFailed', expected: 'Suggestions did not load.' },
    { key: 'search.openHistory', expected: 'Open History' },
    { key: 'search.uploadVideo', expected: 'Upload a video' },
  ] as const)('renders $key with no arguments', ({ key, expected }) => {
    expect(t(key)).toEqual({ ok: true, value: expected });
  });

  it.each([
    { type: 'all', expected: 'All' },
    { type: 'video', expected: 'Videos' },
    { type: 'channel', expected: 'Channels' },
    { type: 'playlist', expected: 'Playlists' },
  ] as const)('names the $type filter', ({ type, expected }) => {
    expect(t('search.type', { type })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { sort: 'relevance', expected: 'Relevance' },
    { sort: 'date', expected: 'Upload date' },
    { sort: 'views', expected: 'View count' },
  ] as const)('names the $sort sort', ({ sort, expected }) => {
    expect(t('search.sort', { sort })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { kind: 'video', expected: 'Videos' },
    { kind: 'channel', expected: 'Channels' },
    { kind: 'playlist', expected: 'Playlists' },
    { kind: 'query', expected: 'Suggestions' },
    { kind: 'recent', expected: 'Recent searches' },
    { kind: 'action', expected: 'Actions' },
  ] as const)('heads the $kind group', ({ kind, expected }) => {
    expect(t('search.group', { kind })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { count: 1, expected: '1 video' },
    { count: 2400, expected: '2.4K videos' },
  ])('counts $count playlist videos', ({ count, expected }) => {
    expect(t('search.playlistVideos', { count })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { count: 0, expected: '0 results' },
    { count: 1, expected: '1 result' },
    { count: 7, expected: '7 results' },
  ])('announces $count results', ({ count, expected }) => {
    expect(t('search.resultCount', { count })).toEqual({ ok: true, value: expected });
  });

  it('names a theme to switch to', () => {
    expect(t('search.switchTheme', { name: 'Nocturne' })).toEqual({
      ok: true,
      value: 'Switch to Nocturne',
    });
  });

  it.each([
    { mode: 'dark', expected: 'Switch to dark mode' },
    { mode: 'oled', expected: 'Switch to OLED mode' },
  ] as const)('names the $mode mode to switch to', ({ mode, expected }) => {
    expect(t('search.switchMode', { mode })).toEqual({ ok: true, value: expected });
  });

  it.each([
    { kind: 'theme', expected: 'theme' },
    { kind: 'mode', expected: 'mode' },
    { kind: 'page', expected: 'page' },
  ] as const)('hints $kind actions', ({ kind, expected }) => {
    expect(t('search.actionKind', { kind })).toEqual({ ok: true, value: expected });
  });
});
