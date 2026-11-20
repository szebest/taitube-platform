import { dt } from '../engine';

export const signInPrompt = {
  body: dt('Your account keeps your likes, subscriptions and playlists on every device.'),
  dismiss: dt('Not now'),
  like: dt('Sign in to like this'),
  dislike: dt('Sign in to dislike this'),
  comment: dt('Sign in to comment'),
  reply: dt('Sign in to reply'),
  heart: dt('Sign in to heart comments'),
  subscribe: dt('Sign in to subscribe to this channel'),
  save: dt('Sign in to save this video'),
  playlist: dt('Sign in to add this to a playlist'),
  queue: dt('Sign in to build a queue'),
  clip: dt('Sign in to make a clip'),
  history: dt('Sign in to keep a watch history'),
  report: dt('Sign in to report this'),
  bell: dt('Sign in to get notifications'),
  feedback: dt('Sign in to tune your recommendations'),
} as const;
