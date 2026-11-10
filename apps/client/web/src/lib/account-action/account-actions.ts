import type { AppAction, AppSubjects } from '@vp/permissions';

export const ACCOUNT_ACTIONS = [
  'like',
  'dislike',
  'comment',
  'reply',
  'heart',
  'subscribe',
  'save',
  'playlist',
  'queue',
  'clip',
  'history',
  'report',
  'bell',
  'feedback',
] as const;

export type AccountAction = (typeof ACCOUNT_ACTIONS)[number];

/** What `@vp/permissions` asks for each account action; a guest fails every one, so each opens the sign-in prompt. */
export const ACCOUNT_ACTION_RULES = {
  like: ['react', 'Video'],
  dislike: ['react', 'Video'],
  comment: ['create', 'Comment'],
  reply: ['create', 'Comment'],
  heart: ['create', 'Comment'],
  subscribe: ['subscribe', 'Channel'],
  save: ['create', 'Playlist'],
  playlist: ['create', 'Playlist'],
  queue: ['queue', 'Queue'],
  clip: ['create', 'Clip'],
  history: ['update', 'Preferences'],
  report: ['report', 'Comment'],
  bell: ['read', 'Notification'],
  feedback: ['create', 'RecommendationFeedback'],
} as const satisfies Record<AccountAction, readonly [AppAction, AppSubjects]>;
