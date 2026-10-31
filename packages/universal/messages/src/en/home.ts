import { dt } from '../define';

export const home = {
  continueWatching: dt('Continue watching'),
  fromSubscriptions: dt('From your subscriptions'),
  becauseSearched: dt('Because you searched for {name}'),
  becauseWatched: dt('Because you watched {name}'),
  popularIn: dt('Popular in {name}'),
  trending: dt('Trending now'),
  rising: dt('Rising creators'),
  notInterested: dt('Not interested'),
  hideChannel: dt("Don't recommend this channel"),
  feedbackSaved: dt('We will recommend less like this'),
  feedbackUndo: dt('Undo'),
  feedbackUndoFailed: dt('Could not undo that'),
  feedbackFailed: dt('Could not save that. The video is back.'),
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
        searched: 'Matches your recent search',
        rising: 'A small channel viewers finish',
      },
    },
  }),
  signedOutSubscriptions: dt('Sign in to see what the channels you follow have posted'),
} as const;
