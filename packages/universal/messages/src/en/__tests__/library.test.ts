import { translatorFor } from '../../__tests__/fixtures';

describe('@vp/messages: en library', () => {
  const { t } = translatorFor('en');

  it.each([
    { key: 'library.youTitle', args: undefined, expected: 'You' },
    { key: 'library.historyTitle', args: undefined, expected: 'Watch history' },
    { key: 'library.shelf', args: { shelf: 'watchLater' }, expected: 'Watch later' },
    { key: 'library.shelf', args: { shelf: 'videos' }, expected: 'Your videos' },
    {
      key: 'library.shelfEmpty',
      args: { shelf: 'history' },
      expected: 'Videos you watch show up here',
    },
    { key: 'library.playlistCount', args: { count: 1 }, expected: '1 video' },
    { key: 'library.playlistCount', args: { count: 24 }, expected: '24 videos' },
    { key: 'library.browse', args: undefined, expected: 'Browse videos' },
    { key: 'library.upload', args: undefined, expected: 'Upload a video' },
    { key: 'library.tabsLabel', args: undefined, expected: 'Your activity' },
    { key: 'library.tab', args: { tab: 'searches' }, expected: 'Searches' },
    { key: 'library.group', args: { group: 'thisWeek' }, expected: 'This week' },
    { key: 'library.filterLabel', args: undefined, expected: 'Filter watch history' },
    { key: 'library.filterPlaceholder', args: undefined, expected: 'Search watch history' },
    { key: 'library.clear', args: { scope: 'searches' }, expected: 'Clear all searches' },
    {
      key: 'library.clearTitle',
      args: { scope: 'history' },
      expected: 'Clear your watch history?',
    },
    {
      key: 'library.clearBody',
      args: { scope: 'searches' },
      expected: 'Every search leaves your history.',
    },
    {
      key: 'library.removeFromHistory',
      args: undefined,
      expected: 'Remove from watch history',
    },
    { key: 'library.removeSearch', args: { query: 'tram' }, expected: 'Remove search tram' },
    { key: 'library.unlike', args: undefined, expected: 'Unlike' },
    { key: 'library.deleteComment', args: undefined, expected: 'Delete comment' },
    { key: 'library.commentOn', args: { title: 'Lisbon' }, expected: 'On Lisbon' },
    { key: 'library.empty', args: { tab: 'liked' }, expected: 'No liked videos yet' },
    {
      key: 'library.noMatches',
      args: { query: 'tram' },
      expected: 'Nothing in your history matches tram',
    },
    {
      key: 'library.changeFailed',
      args: undefined,
      expected: 'That change could not be saved',
    },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
