import { dt } from '../define';

export const library = {
  youTitle: dt('You'),
  historyTitle: dt('Watch history'),
  shelf: dt('{shelf:enum}', {
    enum: {
      shelf: {
        history: 'History',
        watchLater: 'Watch later',
        playlists: 'Playlists',
        videos: 'Your videos',
      },
    },
  }),
  shelfEmpty: dt('{shelf:enum}', {
    enum: {
      shelf: {
        history: 'Videos you watch show up here',
        watchLater: 'Videos you save for later show up here',
        playlists: 'Playlists you make show up here',
        videos: 'Videos you upload show up here',
      },
    },
  }),
  playlistCount: dt('{count:plural}', {
    plural: {
      count: { one: '{?} video', other: '{?} videos', formatter: { notation: 'compact' } },
    },
  }),
  browse: dt('Browse videos'),
  upload: dt('Upload a video'),
  tabsLabel: dt('Your activity'),
  tab: dt('{tab:enum}', {
    enum: {
      tab: { history: 'Watch history', searches: 'Searches', liked: 'Liked', comments: 'Comments' },
    },
  }),
  group: dt('{group:enum}', {
    enum: {
      group: { today: 'Today', yesterday: 'Yesterday', thisWeek: 'This week', older: 'Older' },
    },
  }),
  filterLabel: dt('Filter watch history'),
  filterPlaceholder: dt('Search watch history'),
  clear: dt('{scope:enum}', {
    enum: { scope: { history: 'Clear all watch history', searches: 'Clear all searches' } },
  }),
  clearTitle: dt('{scope:enum}', {
    enum: { scope: { history: 'Clear your watch history?', searches: 'Clear your searches?' } },
  }),
  clearBody: dt('{scope:enum}', {
    enum: {
      scope: {
        history: 'Every video leaves your history and nothing resumes where you stopped.',
        searches: 'Every search leaves your history.',
      },
    },
  }),
  removeFromHistory: dt('Remove from watch history'),
  removeSearch: dt('Remove search {query}'),
  unlike: dt('Unlike'),
  deleteComment: dt('Delete comment'),
  commentOn: dt('On {title}'),
  empty: dt('{tab:enum}', {
    enum: {
      tab: {
        history: 'Nothing watched yet',
        searches: 'No searches yet',
        liked: 'No liked videos yet',
        comments: 'No comments yet',
      },
    },
  }),
  noMatches: dt('Nothing in your history matches {query}'),
  changeFailed: dt('That change could not be saved'),
  saveTitle: dt('Save to playlist'),
  saveBody: dt('Pick the playlists this video belongs to.'),
  saveLoadFailed: dt('Your playlists could not be loaded'),
  saveSignIn: dt('Sign in to save videos to a playlist'),
  savedTo: dt('Saved to {title}'),
  removedFrom: dt('Removed from {title}'),
  newPlaylist: dt('New playlist'),
  playlistCreated: dt('Created {title}'),
  newPlaylistBody: dt('Name it and choose who can see it.'),
  playlistTitleLabel: dt('Title'),
  playlistTitleInvalid: dt('Give the playlist a title'),
  playlistPrivacyLabel: dt('Privacy'),
  createPlaylist: dt('Create'),
  playlistsTitle: dt('Playlists'),
  playlistsLabel: dt('Your playlists'),
  playlistEmpty: dt('Nothing in this playlist yet'),
  playOrder: dt('{mode:enum}', { enum: { mode: { play: 'Play all', shuffle: 'Shuffle' } } }),
  sharePlaylist: dt('Share'),
  playlistOwner: dt('By {name}'),
  playlistDuration: dt('{count:plural}, {duration}', {
    plural: {
      count: { one: '{?} video', other: '{?} videos', formatter: { notation: 'compact' } },
    },
  }),
  playlistDescriptionLabel: dt('Description'),
  editPlaylist: dt('Edit details'),
  savePlaylist: dt('Save'),
  deletePlaylist: dt('Delete playlist'),
  deletePlaylistTitle: dt('Delete this playlist?'),
  deletePlaylistBody: dt('The playlist and its order go. The videos stay where they are.'),
  removeFromPlaylist: dt('Remove from playlist'),
  moveToTop: dt('Move to top'),
  moveToBottom: dt('Move to bottom'),
  playlistItems: dt('Videos in {title}'),
} as const;
