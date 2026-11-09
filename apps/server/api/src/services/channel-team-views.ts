import type { ChannelInviteView, ChannelMemberView, TeamProfileView } from '@vp/api-contracts';
import type { ChannelRepositoryPort } from '@vp/core/repositories';
import type { Channel, ChannelInvite, ChannelMembership } from '@vp/domain';
import { map } from '@vp/result';

export type Profiles = ReadonlyMap<string, TeamProfileView>;

export function profileOf({ handle, displayName, avatarUrl }: Channel): TeamProfileView {
  return { handle, displayName, avatarUrl };
}

/** Each user's own channel as the team pages show them, keyed by user id. */
export async function profilesOf(
  channels: Pick<ChannelRepositoryPort, 'findByUserIds'>,
  userIds: readonly (string | null)[]
) {
  const ids = [...new Set(userIds.filter((id) => id !== null))];
  return map(
    await channels.findByUserIds(ids),
    (found): Profiles => new Map(found.map((channel) => [channel.userId, profileOf(channel)]))
  );
}

export function toMemberView(member: ChannelMembership, profiles: Profiles): ChannelMemberView {
  const { userId, role, invitedBy, createdAt } = member;
  return {
    userId,
    role,
    invitedBy,
    joinedAt: createdAt.toISOString(),
    profile: profiles.get(userId) ?? null,
  };
}

export function toInviteView(invite: ChannelInvite, profiles: Profiles): ChannelInviteView {
  const { id, inviteeUserId, role, invitedBy, status, createdAt, expiresAt } = invite;
  return {
    id,
    inviteeUserId,
    role,
    invitedBy,
    status,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    invitee: profiles.get(inviteeUserId) ?? null,
  };
}
