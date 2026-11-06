import type { ChannelMemberRepositoryPort } from '@vp/core/repositories';
import type { ActingChannel } from '@vp/domain';
import { type ChannelMembershipRequired, decideActingChannel } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, isErr, map } from '@vp/result';
import type { ProvisionFailure } from './channel-lookup';
import type { ChannelService } from './channel-service';

export interface RequestIdentityDeps {
  channels: Pick<ChannelService, 'ensureProvisioned'>;
  members: Pick<ChannelMemberRepositoryPort, 'membershipsOf'>;
}

export interface Identity {
  user: UserContext;
  acting: ActingChannel;
}

export type ResolveIdentityFailure =
  | ProvisionFailure
  | DatabaseUnavailable
  | ChannelMembershipRequired;

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
    const own = await this.deps.channels.ensureProvisioned(principal.id, principal.email);
    if (isErr(own)) return own;

    const memberships = await this.deps.members.membershipsOf(principal.id);
    if (isErr(memberships)) return memberships;

    const user: UserContext = {
      ...principal,
      memberships: Object.fromEntries(
        memberships.value.map(({ channelId, ownerId, role }) => [channelId, { ownerId, role }])
      ),
    };
    return map(
      decideActingChannel({ user, own: own.value, requested: requestedChannelId }),
      (acting) => ({ user, acting })
    );
  }
}
