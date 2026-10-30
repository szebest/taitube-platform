import { dt } from '../define';

export const search = {
  resultsFor: dt('Results for {query}'),
  noResults: dt('Nothing matches {query}'),
  topicsLabel: dt('Suggested topics'),
  viewChannel: dt('View channel'),
  noResultsHint: dt('Check the spelling, or start from one of these topics.'),
  noQuery: dt('Type a word to search for'),
  searchFor: dt('Search for {query}'),
  fuzzyTitle: dt('No exact matches for {query}'),
  fuzzyBody: dt('These are the closest matches instead.'),
  filterLabel: dt('Result type'),
  type: dt('{type:enum}', {
    enum: { type: { all: 'All', video: 'Videos', channel: 'Channels', playlist: 'Playlists' } },
  }),
  sortLabel: dt('Sort by'),
  sort: dt('{sort:enum}', {
    enum: { sort: { relevance: 'Relevance', date: 'Upload date', views: 'View count' } },
  }),
  playlistVideos: dt('{count:plural}', {
    plural: {
      count: { one: '{?} video', other: '{?} videos', formatter: { notation: 'compact' } },
    },
  }),
  group: dt('{kind:enum}', {
    enum: {
      kind: {
        video: 'Videos',
        channel: 'Channels',
        playlist: 'Playlists',
        query: 'Suggestions',
        recent: 'Recent searches',
        action: 'Actions',
      },
    },
  }),
  removeRecent: dt('Remove {query} from recent searches'),
  suggestionsFailed: dt('Suggestions did not load.'),
  resultCount: dt('{count:plural}', {
    plural: { count: { one: '{?} result', other: '{?} results' } },
  }),
  switchTheme: dt('Switch to {name}'),
  switchMode: dt('Switch to {mode:enum}', {
    enum: {
      mode: { system: 'system mode', dark: 'dark mode', light: 'light mode', oled: 'OLED mode' },
    },
  }),
  openHistory: dt('Open History'),
  uploadVideo: dt('Upload a video'),
  actionKind: dt('{kind:enum}', { enum: { kind: { theme: 'theme', mode: 'mode', page: 'page' } } }),
} as const;
