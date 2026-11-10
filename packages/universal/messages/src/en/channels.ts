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
  spotlightTrailer: dt('Channel trailer'),
  spotlightReturning: dt('Welcome back'),
  spotlightWatch: dt('Watch'),
  aboutTitle: dt('About'),
  aboutLinks: dt('Links'),
  aboutCountry: dt('Country'),
  aboutContact: dt('Contact'),
  showContact: dt('Show contact email'),
  contactSignIn: dt('Sign in to see the contact email'),
  contactFailed: dt('The contact email could not be shown'),
} as const;
