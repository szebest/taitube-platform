import { dt } from '../define';

export const commentErrors = {
  commentNotFound: dt('This comment does not exist or was removed.'),
  commentNotPinnable: dt('Only a top-level comment can be pinned.'),
  commentAlreadyReported: dt('You already reported this comment.'),
  commentsBanned: dt('You cannot comment on this channel right now.'),
  commentsDisabled: dt('Comments are turned off for this video.'),
  commentsSubscribersOnly: dt('Only subscribers can comment on this channel.'),
  commentsAccountTooNew: dt('Your account is too new to comment on this channel yet.'),
  commentsSlowMode: dt('Slow mode is on: wait a moment before you comment again.'),
  moderationNotApplicable: dt('That action does not apply to this comment in its current state.'),
  restrictionNotFound: dt('This user has no restriction on the channel.'),
  cannotRestrictMember: dt('The channel owner and its team cannot be restricted.'),
  savedReplyNotFound: dt('This saved reply does not exist.'),
  savedReplyLimit: dt('A channel can keep at most 20 saved replies.'),
};
