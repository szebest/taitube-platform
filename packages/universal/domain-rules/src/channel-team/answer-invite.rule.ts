import type { ChannelInvite } from '@vp/domain';
import { type UserContext, canAnswerChannelInvite } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import {
  type ChannelInviteNotFound,
  type ChannelInviteNotPending,
  channelInviteNotFound,
  channelInviteNotPending,
} from './failures';

type OwnedInvite = ChannelInvite & { readonly ownerId: string };

export interface AnswerInviteInput<I extends OwnedInvite> {
  readonly user: UserContext;
  readonly inviteId: string;
  /** With its channel's owner, which the rules key on. */
  readonly invite: I | null;
}

export type AnswerInviteFailure =
  | AuthorizationFailure
  | ChannelInviteNotFound
  | ChannelInviteNotPending;

/**
 * Only the invitee answers. The owner and managers may update an invite too, so an invite addressed
 * to someone else reads as not found here rather than letting them accept or decline for the invitee.
 */
export function decideInviteAnswer<I extends OwnedInvite>({
  user,
  inviteId,
  invite,
}: AnswerInviteInput<I>): Result<I, AnswerInviteFailure> {
  if (!invite || invite.inviteeUserId !== user.id) return err(channelInviteNotFound(inviteId));

  return andThen(
    authorize(user, canAnswerChannelInvite({ user, invite }), {
      action: 'update',
      subject: 'ChannelInvite',
    }),
    (): Result<I, AnswerInviteFailure> =>
      invite.status === 'pending' ? ok(invite) : err(channelInviteNotPending(inviteId))
  );
}
