import { dt } from '../define';

export const notifications = {
  emptyTitle: dt('No notifications yet'),
  emptyDescription: dt(
    'New uploads from channels you follow and replies to your comments will land here.'
  ),
  manageSubscriptions: dt('Manage subscriptions'),
  filter: dt('{filter:enum}', {
    enum: {
      filter: { all: 'All', subscriptions: 'Subscriptions', mentions: 'Replies' },
    },
  }),
  filtersLabel: dt('Show'),
  today: dt('Today'),
  yesterday: dt('Yesterday'),
  someone: dt('Someone'),
  uploaded: dt('{name} uploaded a video'),
  uploads: dt('{count:plural} from {name}', {
    plural: { count: { one: '{?} new video', other: '{?} new videos' } },
  }),
  live: dt('{name} is live now'),
  reply: dt('{name} replied to your comment'),
  mention: dt('{name} mentioned you'),
  comment: dt('{name} commented on your video'),
  heart: dt('{name} hearted your comment'),
  partyInvite: dt('{name} invited you to a watch party'),
  partyStarting: dt('A watch party is starting'),
  processingReady: dt('Your video is ready to watch'),
  processingFailed: dt('Your video could not be processed'),
  loadFailed: dt('Notifications could not load'),
  loadMoreFailed: dt('More notifications could not load'),
  offline: dt('You are offline. These are the notifications you last loaded.'),
  markReadFailed: dt('Could not mark notifications as read'),
  view: dt('View'),
  channelsTitle: dt('Channels'),
  channelsDescription: dt(
    'Override the choices above for one channel. Highlights is uploads only, with no live streams.'
  ),
  level: dt('{level:enum}', {
    enum: { level: { all: 'All', highlights: 'Highlights', none: 'None' } },
  }),
  levelLabel: dt('Notifications from {name}'),
  levelFailed: dt('Could not save the notifications from this channel'),
} as const;
