import { type Result, err, ok } from '@kit/result';
import type { ActingChannel } from '@vp/domain';
import type { OwnedChannels, UserContext } from '@vp/permissions';
import { type ChannelMembershipRequired, channelMembershipRequired } from './failures';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ActingChannelInput {
  readonly user: UserContext;
  /** The caller's own channels; every signed-in account has a primary one. */
  readonly owned: OwnedChannels;
  /** `X-Channel-Id`, when the request names one. */
  readonly requested?: string;
}

/**
 * The channel a request acts as: the caller's primary unless they name another, and then only one
 * they own or whose team they are on. The role is read from the request's memberships, never from
 * the client.
 */
export function decideActingChannel({
  user,
  owned,
  requested,
}: ActingChannelInput): Result<ActingChannel, ChannelMembershipRequired> {
  const channelId = requested ?? owned.primaryId;
  if (!UUID.test(channelId)) return err(channelMembershipRequired(channelId));
  if (owned.ownedIds.includes(channelId)) return ok({ channelId, ownerId: user.id, role: 'owner' });

  const grant = user.memberships?.[channelId];
  return grant
    ? ok({ channelId, ownerId: grant.ownerId, role: grant.role })
    : err(channelMembershipRequired(channelId));
}
