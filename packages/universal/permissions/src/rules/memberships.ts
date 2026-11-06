import { type ChannelCapability, roleHas } from '@vp/domain';
import type { UserContext } from '../types/index';

interface In {
  $in: string[];
}

function grantsWith(user: UserContext, capability: ChannelCapability) {
  return Object.entries(user.memberships ?? {}).filter(([, grant]) =>
    roleHas(grant.role, capability)
  );
}

function inOrNull(ids: string[]): In | null {
  return ids.length > 0 ? { $in: ids } : null;
}

/**
 * The owners of the channels where the caller holds `capability`, as a condition for the rules on
 * resources that carry an owner's user id; `null` when there are none, so no rule matches on `$in: []`.
 */
export function ownersWith(user: UserContext, capability: ChannelCapability): In | null {
  return inOrNull(grantsWith(user, capability).map(([, grant]) => grant.ownerId));
}

/** The same, for resources that carry the channel's id. */
export function channelsWith(user: UserContext, capability: ChannelCapability): In | null {
  return inOrNull(grantsWith(user, capability).map(([channelId]) => channelId));
}
