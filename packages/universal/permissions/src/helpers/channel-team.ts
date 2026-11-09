import { subject } from '@casl/ability';
import { getUserPermissions } from '../ability';
import type {
  ChannelAuditResource,
  ChannelInviteResource,
  ChannelMemberResource,
  UserContext,
} from '../types/index';

interface OnChannel {
  user: UserContext | null;
  channel: ChannelAuditResource;
}

interface OnInvite {
  user: UserContext | null;
  invite: ChannelInviteResource;
}

interface OnMember {
  user: UserContext | null;
  member: ChannelMemberResource;
}

/** The members and the pending invites of a channel. */
export function canReadChannelTeam({ user, channel }: OnChannel): boolean {
  return getUserPermissions(user).can('read', subject('ChannelMember', { ...channel }));
}

export function canReadChannelAudit({ user, channel }: OnChannel): boolean {
  return getUserPermissions(user).can('read', subject('ChannelAudit', { ...channel }));
}

/** `invite.role` is the role offered, so a manager may not offer `manager`. */
export function canInviteChannelMember({ user, invite }: OnInvite): boolean {
  return getUserPermissions(user).can('create', subject('ChannelInvite', { ...invite }));
}

export function canRevokeChannelInvite({ user, invite }: OnInvite): boolean {
  return getUserPermissions(user).can('delete', subject('ChannelInvite', { ...invite }));
}

export function canAnswerChannelInvite({ user, invite }: OnInvite): boolean {
  return getUserPermissions(user).can('update', subject('ChannelInvite', { ...invite }));
}

/** Asked once with the role held and once with the role given: a manager may hold or give neither. */
export function canChangeChannelMember({ user, member }: OnMember): boolean {
  return getUserPermissions(user).can('update', subject('ChannelMember', { ...member }));
}

export function canRemoveChannelMember({ user, member }: OnMember): boolean {
  return getUserPermissions(user).can('delete', subject('ChannelMember', { ...member }));
}
