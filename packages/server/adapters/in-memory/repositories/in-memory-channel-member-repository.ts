import type {
  ChannelMemberRepositoryPort,
  ChannelRoleChange,
  HeldMembership,
} from '@vp/core/repositories';
import {
  type ChannelMembership,
  type ChannelRole,
  type MemberChannel,
  type NewChannelAuditEntry,
  roleHas,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { andThenAsync, isErr, map, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelInviteRepository } from './in-memory-channel-invite-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';

const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

export interface InMemoryChannelMemberRepositoryOptions {
  channels: Pick<InMemoryChannelRepository, 'findById'>;
  audit: Pick<InMemoryChannelAuditRepository, 'append'>;
  invites: Pick<InMemoryChannelInviteRepository, 'revokeSentBy'>;
}

export class InMemoryChannelMemberRepository implements ChannelMemberRepositoryPort {
  private readonly rows = new Map<string, ChannelMembership>();

  constructor(private readonly deps: InMemoryChannelMemberRepositoryOptions) {}

  async membershipsOf(userId: string): Promise<Result<MemberChannel[], DatabaseUnavailable>> {
    const found: MemberChannel[] = [];
    for (const row of this.rows.values()) {
      if (row.userId !== userId) continue;
      const channel = await this.deps.channels.findById(row.channelId);
      if (isErr(channel)) return channel;
      if (channel.value) {
        found.push({ channelId: row.channelId, ownerId: channel.value.userId, role: row.role });
      }
    }
    return ok(found);
  }

  async listByChannel(
    channelId: string
  ): Promise<Result<ChannelMembership[], DatabaseUnavailable>> {
    return ok(
      [...this.rows.values()]
        .filter((row) => row.channelId === channelId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((row) => ({ ...row }))
    );
  }

  async changeRole(
    { channelId, userId, from, to }: ChannelRoleChange,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelMembership | null, DatabaseUnavailable>> {
    const row = this.rows.get(keyOf(channelId, userId));
    if (row?.role !== from) return ok(null);

    row.role = to;
    const changed = { ...row };
    return andThenAsync(await this.deps.audit.append(audit), async () =>
      roleHas(to, 'team.manage')
        ? ok(changed)
        : map(await this.revokeSentBy(channelId, userId, audit), () => changed)
    );
  }

  async remove(
    { channelId, userId, role }: HeldMembership,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const key = keyOf(channelId, userId);
    if (this.rows.get(key)?.role !== role) return ok(false);
    this.rows.delete(key);
    return andThenAsync(await this.deps.audit.append(audit), async () =>
      map(await this.revokeSentBy(channelId, userId, audit), () => true)
    );
  }

  roleOf(channelId: string, userId: string): ChannelRole | undefined {
    return this.rows.get(keyOf(channelId, userId))?.role;
  }

  private revokeSentBy(
    channelId: string,
    inviterId: string,
    { actorUserId }: NewChannelAuditEntry
  ) {
    return this.deps.invites.revokeSentBy({ channelId, inviterId, actorUserId });
  }

  /** The member half of an accepted invite; an existing membership is kept as it is. */
  join(membership: ChannelMembership): ChannelMembership {
    const key = keyOf(membership.channelId, membership.userId);
    const kept = this.rows.get(key) ?? { ...membership };
    this.rows.set(key, kept);
    return { ...kept };
  }

  clear(): void {
    this.rows.clear();
  }
}
