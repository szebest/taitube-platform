import { type Result, isErr, ok } from '@kit/result';
import type { ChannelMemberRepositoryPort } from '@vp/core/repositories';
import type { ActingChannel, Channel } from '@vp/domain';
import { type ChannelMembershipRequired, decideActingChannel } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { OwnedChannels, UserContext } from '@vp/permissions';
import type { ProvisionFailure } from './channel-lookup';
import type { ChannelService } from './channel-service';

export interface RequestIdentityDeps {
  channels: Pick<ChannelService, 'ensureProvisioned'>;
  members: Pick<ChannelMemberRepositoryPort, 'membershipsOf'>;
}

export interface Identity {
  user: UserContext;
  /** Refused only where a route needs it, so a stale header never locks the caller out of the rest. */
  acting: Result<ActingChannel, ChannelMembershipRequired>;
}

export type ResolveIdentityFailure = ProvisionFailure | DatabaseUnavailable;

/** Provisioning answers the primary first; a list with none marked primary still names one. */
function ownedChannelsOf(owned: readonly Channel[]): OwnedChannels {
  const primary = owned.find((channel) => channel.isPrimary) ?? owned[0];
  return { primaryId: primary?.id ?? '', ownedIds: owned.map((channel) => channel.id) };
}

/**
 * Who a signed-in request is, built fresh on every request: memberships are read from the store,
 * never cached or carried in the token, so a member removed mid-session loses access on the next one.
 */
export class RequestIdentity {
  constructor(private readonly deps: RequestIdentityDeps) {}

  async resolve(
    principal: UserContext,
    requestedChannelId?: string
  ): Promise<Result<Identity, ResolveIdentityFailure>> {
    const owned = await this.deps.channels.ensureProvisioned(principal.id, principal.email);
    if (isErr(owned)) return owned;

    const memberships = await this.deps.members.membershipsOf(principal.id);
    if (isErr(memberships)) return memberships;

    const channels = ownedChannelsOf(owned.value);
    const user: UserContext = {
      ...principal,
      channels,
      memberships: Object.fromEntries(
        memberships.value.map(({ channelId, ownerId, role }) => [channelId, { ownerId, role }])
      ),
    };
    return ok({
      user,
      acting: decideActingChannel({ user, owned: channels, requested: requestedChannelId }),
    });
  }
}
