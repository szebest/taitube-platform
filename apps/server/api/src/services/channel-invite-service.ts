import type { ChannelInviteView, ChannelMembershipView } from '@vp/api-contracts';
import type {
  ChannelInviteRepositoryPort,
  ChannelMemberRepositoryPort,
  ChannelRepositoryPort,
} from '@vp/core/repositories';
import type {
  ActingChannel,
  Channel,
  ChannelInvite,
  ChannelRole,
  NewChannelAuditEntry,
} from '@vp/domain';
import {
  type AnswerInviteFailure,
  type ChannelInviteAlreadyPending,
  type InviteMemberFailure,
  type RevokeInviteFailure,
  channelInviteAlreadyPending,
  channelInviteNotPending,
  decideChannelInvite,
  decideInviteAnswer,
  decideInviteRevoke,
} from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, assertNever, err, isErr, ok } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { profileOf, toInviteView } from './channel-team-views';

export interface ChannelInviteServiceDeps {
  invites: ChannelInviteRepositoryPort;
  members: Pick<ChannelMemberRepositoryPort, 'membershipsOf'>;
  channels: Pick<ChannelRepositoryPort, 'findByHandle' | 'findById'>;
  now: () => number;
}

type AnswerableInvite = ChannelInvite & { ownerId: string; channel: Channel };

type InviteAction = 'invite.created' | 'invite.accepted' | 'invite.declined' | 'invite.revoked';

function auditOf(
  action: InviteAction,
  {
    id,
    channelId,
    inviteeUserId,
    role,
  }: Pick<ChannelInvite, 'id' | 'channelId' | 'inviteeUserId' | 'role'>,
  actorUserId: string
): NewChannelAuditEntry {
  return {
    channelId,
    actorUserId,
    action,
    targetType: 'invite',
    targetId: id,
    meta: { inviteeUserId, role },
  };
}

/** Invites to a channel team: sent and revoked on the acting channel, answered by the invitee alone. */
export class ChannelInviteService {
  constructor(private readonly deps: ChannelInviteServiceDeps) {}

  async create(
    user: UserContext,
    acting: ActingChannel,
    body: { handle: string; role: ChannelRole }
  ): Promise<
    Result<
      ChannelInviteView,
      InviteMemberFailure | ChannelInviteAlreadyPending | DatabaseUnavailable
    >
  > {
    const { invites, members, channels, now } = this.deps;

    const found = await channels.findByHandle(body.handle);
    if (isErr(found)) return found;
    const invitee = found.value;

    const held = invitee ? await members.membershipsOf(invitee.userId) : ok([]);
    if (isErr(held)) return held;

    const decided = decideChannelInvite({
      user,
      acting,
      handle: body.handle,
      invitee: invitee && { userId: invitee.userId },
      isMember: held.value.some(({ channelId }) => channelId === acting.channelId),
      role: body.role,
      id: uuidv7(),
      now: new Date(now()),
    });
    if (isErr(decided)) return decided;

    const created = await invites.create(
      decided.value,
      auditOf('invite.created', decided.value, user.id)
    );
    if (isErr(created)) return created;
    const outcome = created.value;
    switch (outcome.type) {
      case 'created':
        return ok(
          toInviteView(
            outcome.invite,
            new Map(invitee ? [[invitee.userId, profileOf(invitee)]] : [])
          )
        );
      case 'already-pending':
        return err(channelInviteAlreadyPending(decided.value.inviteeUserId));
      default:
        return assertNever(outcome, 'CreateInviteOutcome');
    }
  }

  async revoke(
    user: UserContext,
    acting: ActingChannel,
    inviteId: string
  ): Promise<Result<void, RevokeInviteFailure | DatabaseUnavailable>> {
    const found = await this.deps.invites.findById(inviteId);
    if (isErr(found)) return found;

    const decided = decideInviteRevoke({ user, acting, inviteId, invite: found.value });
    if (isErr(decided)) return decided;

    return this.close(decided.value, 'revoked', user);
  }

  async accept(
    user: UserContext,
    inviteId: string
  ): Promise<Result<ChannelMembershipView, AnswerInviteFailure | DatabaseUnavailable>> {
    const answered = await this.answerable(user, inviteId);
    if (isErr(answered)) return answered;
    const invite = answered.value;

    const accepted = await this.deps.invites.accept(
      inviteId,
      user.id,
      auditOf('invite.accepted', invite, user.id)
    );
    if (isErr(accepted)) return accepted;
    const outcome = accepted.value;
    switch (outcome.type) {
      case 'accepted':
        return ok({
          channelId: invite.channelId,
          ownerId: invite.ownerId,
          role: outcome.membership.role,
          channel: profileOf(invite.channel),
        });
      case 'not-pending':
        return err(channelInviteNotPending(inviteId));
      default:
        return assertNever(outcome, 'AcceptInviteOutcome');
    }
  }

  async decline(
    user: UserContext,
    inviteId: string
  ): Promise<Result<void, AnswerInviteFailure | DatabaseUnavailable>> {
    const answered = await this.answerable(user, inviteId);
    if (isErr(answered)) return answered;

    return this.close(answered.value, 'declined', user);
  }

  /** The invite with its channel, once the caller may answer it. */
  private async answerable(
    user: UserContext,
    inviteId: string
  ): Promise<Result<AnswerableInvite, AnswerInviteFailure | DatabaseUnavailable>> {
    const { invites, channels } = this.deps;

    const found = await invites.findById(inviteId);
    if (isErr(found)) return found;
    const invite = found.value;
    const channel = invite ? await channels.findById(invite.channelId) : ok(null);
    if (isErr(channel)) return channel;
    const owner = channel.value;

    return decideInviteAnswer({
      user,
      inviteId,
      invite: invite && owner ? { ...invite, ownerId: owner.userId, channel: owner } : null,
    });
  }

  private async close(invite: ChannelInvite, status: 'declined' | 'revoked', user: UserContext) {
    const closed = await this.deps.invites.close(
      invite.id,
      status,
      auditOf(status === 'declined' ? 'invite.declined' : 'invite.revoked', invite, user.id)
    );
    if (isErr(closed)) return closed;
    return closed.value ? ok() : err(channelInviteNotPending(invite.id));
  }
}
