import { dt } from '../engine';

export const postErrors = {
  postNotFound: dt('This post does not exist or was deleted.'),
  postShareNotPublic: dt('Only a public video or playlist can be shared in a post.'),
  postDailyLimit: dt('This channel has published as many posts as it can today.'),
  postAlreadyVoted: dt('You have already voted on this post.'),
  postPollClosed: dt('This poll has closed.'),
  postPollLocked: dt('A poll cannot change after the first vote.'),
  postPinLimit: dt('A channel can pin up to 3 posts. Unpin one first.'),
  postDraftLimit: dt('This channel holds as many drafts and scheduled posts as it can.'),
  postScheduleInvalid: dt('Pick a time in the future for a scheduled post.'),
  postImageNotReady: dt('An image of this post is not ready or is not from this channel.'),
  threadNotFound: dt('This thread does not exist or was removed.'),
  threadLimit: dt('You already have 5 open threads on this video.'),
  threadPinLimit: dt('A video can pin up to 3 threads. Unpin one first.'),
  threadAnchorInvalid: dt('Pick a moment inside the video.'),
} as const;
