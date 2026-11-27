import { dt } from '@vp/shared-messages';

export const threads = {
  replyCount: dt('{count:plural}', {
    plural: {
      count: { one: '{?} reply', other: '{?} replies', formatter: { notation: 'compact' } },
    },
  }),
  tabsLabel: dt('Discussion'),
  tab: dt('{tab:enum}', { enum: { tab: { comments: 'Comments', threads: 'Threads' } } }),
  listTitle: dt('Threads'),
  listEmpty: dt('No threads yet. Start one at a moment of the video.'),
  listFailed: dt('The threads could not be loaded'),
  pinned: dt('Pinned'),
  anchorAt: dt('At {time}'),
  openThread: dt('Open thread'),
  startAt: dt('Start a thread at {time}'),
  formTitle: dt('Start a thread'),
  formDescription: dt('Talk about {time}. The thread shows on the seek bar once it has replies.'),
  titleLabel: dt('Title'),
  bodyLabel: dt('Details (optional)'),
  counter: dt('{count:number} / {max:number}'),
  submit: dt('Start thread'),
  createFailed: dt('Your thread could not be started'),
  jumpTo: dt('Go to {time}'),
  panelFailed: dt('The thread could not be loaded'),
  repliesTitle: dt('Replies'),
  repliesEmpty: dt('No replies yet'),
  repliesFailed: dt('The replies could not be loaded'),
  replyFailed: dt('Your reply could not be sent'),
} as const;
