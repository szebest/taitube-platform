import type { ActingChannel } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { type Result, err, ok } from '@vp/result';
import { type ChannelMembershipRequired, channelMembershipRequired } from './failures';

export interface ActingChannelInput {
  readonly user: UserContext;
  /** The caller's own channel, which every signed-in account has. */
  readonly own: { readonly id: string };
  /** `X-Channel-Id`, when the request names one. */
  readonly requested?: string;
}

/**
 * The channel a studio request works on: the caller's own unless they name another, and then only
 * one whose team they are on. The role is read from the request's memberships, never from the client.
 */
export function decideActingChannel({
  user,
  own,
  requested,
}: ActingChannelInput): Result<ActingChannel, ChannelMembershipRequired> {
  if (requested === undefined || requested === own.id) {
    return ok({ channelId: own.id, ownerId: user.id, role: 'owner' });
  }

  const grant = user.memberships?.[requested];
  return grant
    ? ok({ channelId: requested, ownerId: grant.ownerId, role: grant.role })
    : err(channelMembershipRequired(requested));
}
