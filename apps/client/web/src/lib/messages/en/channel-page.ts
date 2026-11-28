import { dt } from '@vp/shared-messages';

export const channelPage = {
  tabsLabel: dt('Channel sections'),
  seeAll: dt('See all'),
  empty: dt('Nothing here yet'),
  untitled: dt('Featured'),
  previewing: dt('Previewing the draft as {audience:enum}', {
    enum: { audience: { visitor: 'a new visitor', subscriber: 'a subscriber' } },
  }),
  playlistVideos: dt('{count:plural}', {
    plural: {
      count: { one: '{?} video', other: '{?} videos', formatter: { notation: 'compact' } },
    },
  }),
  liveStatus: dt('{status:enum}', {
    enum: { status: { IDLE: 'Upcoming', LIVE: 'Live now', ENDED: 'Past stream' } },
  }),
  liveViewers: dt('{count:plural}', {
    plural: {
      count: { one: '{?} watching', other: '{?} watching', formatter: { notation: 'compact' } },
    },
  }),
  postTile: dt('Post'),
  playlistTile: dt('Playlist'),
  linksLabel: dt('Links'),
} as const;
