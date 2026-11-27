import type { Account, ChannelMembershipView } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import { account, CHANNEL_ID, COMMENT_AUTHOR_ID, OWNER_ID } from '@vp/web-testing';

export { COMMENT_ID, comment } from '@vp/web-testing';

export const REPLY_ID = '0190c3a0-5e1d-7000-8000-00000000d002';
export const AUTHOR_ID = COMMENT_AUTHOR_ID;
export const OTHER_ID = '0190c3a0-5e1d-7000-8000-00000000b003';

/** A signed-in account with `id` and `role`; the default one is the video's owner. */
export function viewerAccount(id: string = OWNER_ID, role: Account['role'] = 'USER'): Account {
  const { user } = account();
  return account({ role, user: { ...user, id } });
}

/** The video's channel, as a team member of `role` sees it in their memberships. */
export function membershipOn(role: ChannelRole): ChannelMembershipView {
  return {
    channelId: CHANNEL_ID,
    ownerId: OWNER_ID,
    role,
    channel: { handle: 'launch', displayName: 'Launch', avatarUrl: null },
  };
}
