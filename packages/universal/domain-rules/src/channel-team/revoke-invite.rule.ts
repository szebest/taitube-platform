import type { ActingChannel, ChannelInvite } from '@vp/domain';
import { type UserContext, canRevokeChannelInvite } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ChannelInviteNotFound,
  type ChannelInviteNotPending,
  channelInviteNotFound,
  channelInviteNotPending,
} from './failures';

export interface RevokeInviteInput {
  readonly user: UserContext;
  readonly acting: ActingChannel;
  readonly inviteId: string;
  readonly invite: ChannelInvite | null;
}

export type RevokeInviteFailure =
  | AuthorizationFailure
  | ChannelInviteNotFound
  | ChannelInviteNotPending;

const REVOKE = { action: 'delete', subject: 'ChannelInvite' } as const;

/** An invite to another channel is not found: the acting channel is the only one in view. */
export function decideInviteRevoke({
  user,
  acting,
  inviteId,
  invite,
}: RevokeInviteInput): Result<ChannelInvite, RevokeInviteFailure> {
  const { channelId, ownerId } = acting;

  return andThen(
    authorize(user, canRevokeChannelInvite({ user, invite: { channelId, ownerId } }), REVOKE),
    (): Result<ChannelInvite, RevokeInviteFailure> => {
      if (!invite || invite.channelId !== channelId) return err(channelInviteNotFound(inviteId));
      const { inviteeUserId, role } = invite;
      return andThen(
        authorize(
          user,
          canRevokeChannelInvite({ user, invite: { channelId, ownerId, inviteeUserId, role } }),
          REVOKE
        ),
        (): Result<ChannelInvite, RevokeInviteFailure> =>
          invite.status === 'pending' ? ok(invite) : err(channelInviteNotPending(inviteId))
      );
    }
  );
}
