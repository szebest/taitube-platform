import { dt } from '../engine';

export const channelErrors = {
  channelMembershipRequired: dt('You are not on the team of this channel any more.'),
  channelLimitReached: dt('You own as many channels as an account can. Remove one to add another.'),
  channelNotOwned: dt('Only the owner of this channel can do that.'),
  channelInviteNotFound: dt('This invite does not exist.'),
  channelInviteNotPending: dt(
    'This invite is no longer open: it was answered, revoked or has expired.'
  ),
  channelInviteAlreadyPending: dt('This person already has an open invite to the team.'),
  channelMemberExists: dt('This person is already on the team.'),
  channelMemberNotFound: dt('This person is not on the team.'),
  channelOwnerImmutable: dt('The channel owner cannot be removed or given another role.'),
};
