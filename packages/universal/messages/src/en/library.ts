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
} as const;
