import type { ChannelMemberRepositoryPort } from '@vp/core/repositories';
import type {
  ChannelMembership,
  ChannelRole,
  MemberChannel,
  NewChannelAuditEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, map, ok, type Result } from '@vp/result';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';

const keyOf = (channelId: string, userId: string) => `${channelId}:${userId}`;

export interface InMemoryChannelMemberRepositoryOptions {
  channels: Pick<InMemoryChannelRepository, 'findById'>;
  audit: Pick<InMemoryChannelAuditRepository, 'append'>;
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
    channelId: string,
    userId: string,
    role: ChannelRole,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelMembership | null, DatabaseUnavailable>> {
    const row = this.rows.get(keyOf(channelId, userId));
    if (!row) return ok(null);

    row.role = role;
    return map(await this.deps.audit.append(audit), () => ({ ...row }));
  }

  async remove(
    channelId: string,
    userId: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!this.rows.delete(keyOf(channelId, userId))) return ok(false);
    return map(await this.deps.audit.append(audit), () => true);
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
