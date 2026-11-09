import type { ChannelMembershipView, ChannelMemberView, ChannelTeamView } from '@vp/api-contracts';
import type {
  ChannelInviteRepositoryPort,
  ChannelMemberRepositoryPort,
  ChannelRepositoryPort,
} from '@vp/core/repositories';
import type { ActingChannel, ChannelRole } from '@vp/domain';
import {
  type AuthorizationFailure,
  type ChangeMemberRoleFailure,
  type RemoveMemberFailure,
  channelMemberNotFound,
  decideChannelTask,
  decideMemberRemoval,
  decideMemberRoleChange,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import { profileOf, profilesOf, toInviteView, toMemberView } from './channel-team-views';

export interface ChannelMemberServiceDeps {
  members: ChannelMemberRepositoryPort;
  invites: Pick<ChannelInviteRepositoryPort, 'listPending'>;
  channels: Pick<ChannelRepositoryPort, 'findByUserIds'>;
}

/** The team of the acting channel, and the channels the caller works on. */
export class ChannelMemberService {
  constructor(private readonly deps: ChannelMemberServiceDeps) {}

  async team(
    user: UserContext,
    acting: ActingChannel
  ): Promise<Result<ChannelTeamView, AuthorizationFailure | DatabaseUnavailable>> {
    const { members, invites, channels } = this.deps;

    const allowed = decideChannelTask({ user, acting, task: 'read-team' });
    if (isErr(allowed)) return allowed;

    const listed = await members.listByChannel(acting.channelId);
    if (isErr(listed)) return listed;
    const pending = await invites.listPending(acting.channelId);
    if (isErr(pending)) return pending;

    const userIds = [
      ...listed.value.map(({ userId }) => userId),
      ...pending.value.map(({ inviteeUserId }) => inviteeUserId),
    ];
    return map(await profilesOf(channels, userIds), (profiles) => ({
      members: listed.value.map((member) => toMemberView(member, profiles)),
      invites: pending.value.map((invite) => toInviteView(invite, profiles)),
    }));
  }

  async changeRole(
    user: UserContext,
    acting: ActingChannel,
    userId: string,
    to: ChannelRole
  ): Promise<Result<ChannelMemberView, ChangeMemberRoleFailure | DatabaseUnavailable>> {
    const member = await this.memberOf(acting, userId);
    if (isErr(member)) return member;

    const decided = decideMemberRoleChange({ user, acting, userId, member: member.value, to });
    if (isErr(decided)) return decided;
    const change = decided.value;

    const changed = await this.deps.members.changeRole(change, {
      channelId: acting.channelId,
      actorUserId: user.id,
      action: 'member.role_changed',
      targetType: 'member',
      targetId: userId,
      meta: { from: change.from, to: change.to },
    });
    if (isErr(changed)) return changed;
    const updated = changed.value;
    if (!updated) return err(channelMemberNotFound(userId));

    return map(await profilesOf(this.deps.channels, [userId]), (profiles) =>
      toMemberView(updated, profiles)
    );
  }

  async remove(
    user: UserContext,
    acting: ActingChannel,
    userId: string
  ): Promise<Result<void, RemoveMemberFailure | DatabaseUnavailable>> {
    const member = await this.memberOf(acting, userId);
    if (isErr(member)) return member;

    const decided = decideMemberRemoval({ user, acting, userId, member: member.value });
    if (isErr(decided)) return decided;
    const { member: held, action } = decided.value;

    const removed = await this.deps.members.remove(held, {
      channelId: acting.channelId,
      actorUserId: user.id,
      action,
      targetType: 'member',
      targetId: userId,
      meta: { role: held.role },
    });
    if (isErr(removed)) return removed;
    return removed.value ? ok() : err(channelMemberNotFound(userId));
  }

  async memberships(
    user: UserContext
  ): Promise<Result<{ items: ChannelMembershipView[] }, DatabaseUnavailable>> {
    const held = await this.deps.members.membershipsOf(user.id);
    if (isErr(held)) return held;

    const owners = await this.deps.channels.findByUserIds(held.value.map(({ ownerId }) => ownerId));
    if (isErr(owners)) return owners;
    const byId = new Map(owners.value.map((channel) => [channel.id, channel]));

    return ok({
      items: held.value.flatMap(({ channelId, ownerId, role }): ChannelMembershipView[] => {
        const channel = byId.get(channelId);
        return channel ? [{ channelId, ownerId, role, channel: profileOf(channel) }] : [];
      }),
    });
  }

  private async memberOf(acting: ActingChannel, userId: string) {
    return map(
      await this.deps.members.listByChannel(acting.channelId),
      (members) => members.find((member) => member.userId === userId) ?? null
    );
  }
}
