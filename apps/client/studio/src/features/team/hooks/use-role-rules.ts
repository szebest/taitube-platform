import type { ChannelRole } from '@vp/domain';
import {
  canChangeChannelMember,
  canInviteChannelMember,
  canRemoveChannelMember,
  canRevokeChannelInvite,
} from '@vp/permissions';
import { usePermissions } from '@vp/permissions-react';
import { useActiveChannel } from '#app/features/team/hooks/use-active-channel';

/** What the viewer may do to a member or an invite of the acting channel; a manager may touch neither the manager role nor a manager. */
export function useRoleRules() {
  const { userContext } = usePermissions();
  const { channelId, ownerId } = useActiveChannel();
  const channel = { channelId, ownerId };

  return {
    canInvite: (role: ChannelRole) =>
      canInviteChannelMember({ user: userContext, invite: { ...channel, role } }),
    canRevoke: (role: ChannelRole) =>
      canRevokeChannelInvite({ user: userContext, invite: { ...channel, role } }),
    canAssign: (role: ChannelRole) =>
      canChangeChannelMember({ user: userContext, member: { ...channel, role } }),
    canRemove: (userId: string, role: ChannelRole) =>
      canRemoveChannelMember({ user: userContext, member: { ...channel, userId, role } }),
  };
}
