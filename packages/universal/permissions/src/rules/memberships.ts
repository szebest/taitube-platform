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
 * The channels where the caller holds `capability`, as a condition on the channel id a resource carries;
 * `null` when there are none, so no rule matches on `$in: []`.
 */
export function channelsWith(user: UserContext, capability: ChannelCapability): In | null {
  return inOrNull(grantsWith(user, capability).map(([channelId]) => channelId));
}
