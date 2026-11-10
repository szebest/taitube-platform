import { type UserContext, canRestrictChannelUser } from '@vp/permissions';
import { type Result, andThen, err, ok } from '@vp/result';
import { type AuthorizationFailure, authorize } from '../authorize';
import { type CannotRestrictMember, cannotRestrictMember } from './failures';

export interface ChannelUserRestrictionInput {
  readonly actor: UserContext | null;
  readonly channel: { readonly channelId: string; readonly ownerId: string };
  readonly targetUserId: string;
  /** Whether the target holds a role on the channel; the owner has no membership row. */
  readonly targetIsMember: boolean;
}

export type ChannelUserRestrictionFailure = AuthorizationFailure | CannotRestrictMember;

/** Shadow ban, ban and lift are one permission; only a user who is not on the team can be restricted. */
export function decideChannelUserRestriction(
  input: ChannelUserRestrictionInput
): Result<string, ChannelUserRestrictionFailure> {
  const { actor, channel, targetUserId, targetIsMember } = input;
  return andThen(
    authorize(actor, canRestrictChannelUser({ user: actor, channel }), {
      action: 'restrict',
      subject: 'ChannelUser',
    }),
    (): Result<string, CannotRestrictMember> =>
      targetIsMember || targetUserId === channel.ownerId
        ? err(cannotRestrictMember(targetUserId))
        : ok(targetUserId)
  );
}
