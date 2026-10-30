import { dt } from '../define';

export const watch = {
  subscribe: dt('Subscribe'),
  subscribed: dt('Subscribed'),
  share: dt('Share'),
  shareTitle: dt('Share this video'),
  shareLink: dt('Link'),
  shareStartAt: dt('Start at {time}'),
  linkCopied: dt('Link copied'),
  copyFailed: dt('The link could not be copied'),
  subscribeFailed: dt('Your subscription could not be changed'),
  reactionFailed: dt('Your reaction could not be saved'),
} as const;
