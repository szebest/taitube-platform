import type { AbilityBuilder } from '@casl/ability';
import { type AppAbility, type UserContext, isSignedInRole } from '../types/index';
import { channelsWith } from './memberships';

/** A manager runs the team but never touches another manager; only the owner does. */
export function defineChannelTeamRules(
  user: UserContext | null,
  builder: AbilityBuilder<AppAbility>
): void {
  if (!(user && isSignedInRole(user.role))) return;
  const { can } = builder;

  can('manage', 'ChannelMember', { ownerId: user.id });
  can('manage', 'ChannelInvite', { ownerId: user.id });
  can('read', 'ChannelAudit', { ownerId: user.id });

  can('delete', 'ChannelMember', { userId: user.id });
  can('update', 'ChannelInvite', { inviteeUserId: user.id });

  const managed = channelsWith(user, 'team.manage');
  if (!managed) return;

  can('read', 'ChannelMember', { channelId: managed });
  can('read', 'ChannelInvite', { channelId: managed });
  can('read', 'ChannelAudit', { channelId: managed });
  for (const action of ['create', 'update', 'delete'] as const) {
    can(action, 'ChannelMember', { channelId: managed, role: { $ne: 'manager' } });
    can(action, 'ChannelInvite', { channelId: managed, role: { $ne: 'manager' } });
  }
}
