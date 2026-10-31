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
    { key: 'library.saveTitle', args: undefined, expected: 'Save to playlist' },
    {
      key: 'library.saveBody',
      args: undefined,
      expected: 'Pick the playlists this video belongs to.',
    },
    {
      key: 'library.saveLoadFailed',
      args: undefined,
      expected: 'Your playlists could not be loaded',
    },
    {
      key: 'library.saveSignIn',
      args: undefined,
      expected: 'Sign in to save videos to a playlist',
    },
    { key: 'library.savedTo', args: { title: 'Trips' }, expected: 'Saved to Trips' },
    { key: 'library.removedFrom', args: { title: 'Trips' }, expected: 'Removed from Trips' },
    { key: 'library.newPlaylist', args: undefined, expected: 'New playlist' },
    { key: 'library.playlistCreated', args: { title: 'Trips' }, expected: 'Created Trips' },
    {
      key: 'library.newPlaylistBody',
      args: undefined,
      expected: 'Name it and choose who can see it.',
    },
    { key: 'library.playlistTitleLabel', args: undefined, expected: 'Title' },
    {
      key: 'library.playlistTitleInvalid',
      args: undefined,
      expected: 'Give the playlist a title',
    },
    { key: 'library.playlistPrivacyLabel', args: undefined, expected: 'Privacy' },
    { key: 'library.createPlaylist', args: undefined, expected: 'Create' },
    { key: 'library.playlistsTitle', args: undefined, expected: 'Playlists' },
    { key: 'library.playlistsLabel', args: undefined, expected: 'Your playlists' },
    { key: 'library.playlistEmpty', args: undefined, expected: 'Nothing in this playlist yet' },
    { key: 'library.playOrder', args: { mode: 'play' }, expected: 'Play all' },
    { key: 'library.playOrder', args: { mode: 'shuffle' }, expected: 'Shuffle' },
    { key: 'library.sharePlaylist', args: undefined, expected: 'Share' },
    { key: 'library.playlistOwner', args: { name: 'Marta' }, expected: 'By Marta' },
    {
      key: 'library.playlistDuration',
      args: { count: 1, duration: '3 minutes' },
      expected: '1 video, 3 minutes',
    },
    {
      key: 'library.playlistDuration',
      args: { count: 24, duration: '2 hours' },
      expected: '24 videos, 2 hours',
    },
    { key: 'library.playlistDescriptionLabel', args: undefined, expected: 'Description' },
    { key: 'library.editPlaylist', args: undefined, expected: 'Edit details' },
    { key: 'library.savePlaylist', args: undefined, expected: 'Save' },
    { key: 'library.deletePlaylist', args: undefined, expected: 'Delete playlist' },
    { key: 'library.deletePlaylistTitle', args: undefined, expected: 'Delete this playlist?' },
    {
      key: 'library.deletePlaylistBody',
      args: undefined,
      expected: 'The playlist and its order go. The videos stay where they are.',
    },
    { key: 'library.removeFromPlaylist', args: undefined, expected: 'Remove from playlist' },
    { key: 'library.moveToTop', args: undefined, expected: 'Move to top' },
    { key: 'library.moveToBottom', args: undefined, expected: 'Move to bottom' },
    { key: 'library.playlistItems', args: { title: 'Trips' }, expected: 'Videos in Trips' },
  ] as const)('writes $key', ({ key, args, expected }) => {
    expect(t(key, ...(args ? [args] : []))).toEqual({ ok: true, value: expected });
  });
});
