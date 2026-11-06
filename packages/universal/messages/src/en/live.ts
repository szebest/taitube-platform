import { dt } from '../define';

export const live = {
  title: dt('Live'),
  emptyTitle: dt('Nothing is live right now'),
  emptyDescription: dt('When a channel goes live, its stream and chat will be here.'),
  browse: dt('Browse videos'),
  nowShelf: dt('Live now'),
  watching: dt('{count:plural}', {
    plural: {
      count: { one: '{?} watching', other: '{?} watching', formatter: { notation: 'compact' } },
    },
  }),
  chatTitle: dt('Live chat'),
  replayTitle: dt('Chat replay'),
  showReplay: dt('Show chat replay'),
  hideReplay: dt('Hide chat replay'),
  replayEmpty: dt('No one had written in the chat by this point.'),
  endedTitle: dt('This broadcast has ended'),
  endedProcessing: dt('The recording will be here once it is ready.'),
  signInToChat: dt('Sign in to chat'),
  chatReconnecting: dt('Reconnecting to the chat...'),
  chatSlowMode: dt('{seconds:plural}', {
    plural: {
      seconds: {
        one: 'Slow mode: one message every second',
        other: 'Slow mode: one message every {?} seconds',
      },
    },
  }),
  chatUnavailable: dt('You cannot chat right now.'),
  chatSubscribersOnly: dt('Only subscribers can chat right now'),
  headDescription: dt('{name} live on Taitube.'),
  you: dt('You'),
} as const;
