import type {
  ChannelMemberRepositoryPort,
  ChannelRoleChange,
  HeldMembership,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ChannelMembership, MemberChannel, NewChannelAuditEntry } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, type Result } from '@vp/result';
import { and, asc, eq } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import type { PostgresDatabase } from './types';

const { channelMembers: m, channels: c } = schema;

export class PostgresChannelMemberRepository implements ChannelMemberRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async membershipsOf(userId: string): Promise<Result<MemberChannel[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select({ channelId: m.channelId, ownerId: c.userId, role: m.role })
          .from(m)
          .innerJoin(c, eq(c.id, m.channelId))
          .where(eq(m.userId, userId)),
      databaseUnavailable.during('membershipsOf')
    );
  }

  async listByChannel(
    channelId: string
  ): Promise<Result<ChannelMembership[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(m)
          .where(eq(m.channelId, channelId))
          .orderBy(asc(m.createdAt), asc(m.userId)),
      databaseUnavailable.during('listChannelMembers')
    );
  }

  async changeRole(
    { channelId, userId, from, to }: ChannelRoleChange,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelMembership | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [changed] = await tx
            .update(m)
            .set({ role: to })
            .where(and(eq(m.channelId, channelId), eq(m.userId, userId), eq(m.role, from)))
            .returning();
          if (!changed) return null;

          await appendChannelAudit(tx, audit);
          return changed;
        }),
      databaseUnavailable.during('changeChannelMemberRole')
    );
  }

  async remove(
    { channelId, userId, role }: HeldMembership,
    audit: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [gone] = await tx
            .delete(m)
            .where(and(eq(m.channelId, channelId), eq(m.userId, userId), eq(m.role, role)))
            .returning({ userId: m.userId });
          if (!gone) return false;

          await appendChannelAudit(tx, audit);
          return true;
        }),
      databaseUnavailable.during('removeChannelMember')
    );
  }
}
