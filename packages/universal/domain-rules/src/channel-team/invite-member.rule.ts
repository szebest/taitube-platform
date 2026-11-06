import {
  type ActingChannel,
  CHANNEL_INVITE_TTL_DAYS,
  type ChannelInvite,
  type ChannelRole,
} from '@vp/domain';
import { type UserContext, canInviteChannelMember } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type ChannelNotFound, channelNotFound } from '../channels/failures';
import { type ChannelMemberExists, channelMemberExists } from './failures';

const DAY_MS = 86_400_000;

export interface InviteMemberInput {
  readonly user: UserContext;
  readonly acting: ActingChannel;
  readonly handle: string;
  /** The account behind `handle`; `null` when no channel has it. */
  readonly invitee: { readonly userId: string } | null;
  /** Whether the invitee already holds a role on the acting channel. */
  readonly isMember: boolean;
  readonly role: ChannelRole;
  readonly id: string;
  readonly now: Date;
}

export type NewInvite = Omit<ChannelInvite, 'status' | 'createdAt'>;

export type InviteMemberFailure = AuthorizationFailure | ChannelNotFound | ChannelMemberExists;

/** The owner is on every team of their channel already, so inviting them is inviting a member. */
export function decideChannelInvite(
  input: InviteMemberInput
): Result<NewInvite, InviteMemberFailure> {
  const { user, acting, handle, invitee, isMember, role, id, now } = input;
  const { channelId, ownerId } = acting;

  return andThen(
    authorize(user, canInviteChannelMember({ user, invite: { channelId, ownerId, role } }), {
      action: 'create',
      subject: 'ChannelInvite',
    }),
    (): Result<NewInvite, InviteMemberFailure> => {
      if (!invitee) return err(channelNotFound(handle));
      if (isMember || invitee.userId === ownerId) return err(channelMemberExists(invitee.userId));
      return ok({
        id,
        channelId,
        inviteeUserId: invitee.userId,
        role,
        invitedBy: user.id,
        expiresAt: new Date(now.getTime() + CHANNEL_INVITE_TTL_DAYS * DAY_MS),
      });
    }
  );
}
