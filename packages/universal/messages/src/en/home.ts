import { dt } from '../define';

export const home = {
  continueWatching: dt('Continue watching'),
  fromSubscriptions: dt('From your subscriptions'),
  becauseWatched: dt('Because you watched {name}'),
  popularIn: dt('Popular in {name}'),
  trending: dt('Trending now'),
  empty: dt('Nothing to watch yet'),
  pickWindow: dt('Picked today, {left} left'),
  pickWatch: dt('Watch'),
  reason: dt('{kind:enum}', {
    enum: {
      kind: {
        continue: 'Pick up where you left off',
        subscription: 'From a channel you follow',
        'co-watched': 'Viewers also watched',
        'shared-tags': 'Similar topics',
        'same-channel': 'From the same channel',
        'same-category': 'In the same category',
        category: 'Popular in this category',
        trending: 'Trending now',
      },
    },
  }),
  signedOutSubscriptions: dt('Sign in to see what the channels you follow have posted'),
} as const;
