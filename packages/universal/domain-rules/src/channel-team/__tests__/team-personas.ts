import type { ActingChannel, ActingRole, ChannelMembership, ChannelRole } from '@vp/domain';
import type { UserContext } from '@vp/permissions';

export const OWNER_ID = 'owner-1';
export const CHANNEL_ID = 'chan-1';

/** The caller and the channel they act on, holding `role` there. */
export function actingAs(
  role: ActingRole,
  id = `${role}-1`
): {
  user: UserContext;
  acting: ActingChannel;
} {
  const acting = { channelId: CHANNEL_ID, ownerId: OWNER_ID, role };
  if (role === 'owner') return { user: { id: OWNER_ID, role: 'USER' }, acting };
  return {
    user: { id, role: 'USER', memberships: { [CHANNEL_ID]: { role, ownerId: OWNER_ID } } },
    acting,
  };
}

export function membership(userId: string, role: ChannelRole): ChannelMembership {
  return { channelId: CHANNEL_ID, userId, role, invitedBy: OWNER_ID, createdAt: new Date(0) };
}
