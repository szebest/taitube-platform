import { dt } from '../define';

export const channels = {
  subscribers: dt('{count:plural}', {
    plural: {
      count: {
        one: '{?} subscriber',
        other: '{?} subscribers',
        formatter: { notation: 'compact' },
      },
    },
  }),
  handle: dt('@{handle}'),
  subscribe: dt('Subscribe'),
  subscribed: dt('Subscribed'),
  subscriptionsTitle: dt('Your subscriptions'),
  subscriptionsEmpty: dt('You are not subscribed to any channel yet'),
  subscriptionVideosTitle: dt('Subscription videos'),
  yourVideos: dt('Your videos'),
  viewChannel: dt('View channel'),
} as const;
