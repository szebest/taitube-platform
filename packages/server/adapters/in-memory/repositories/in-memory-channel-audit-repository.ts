import type { ChannelAuditQuery, ChannelAuditRepositoryPort } from '@vp/core/repositories';
import type { ChannelAuditEntry, NewChannelAuditEntry } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keysetOf = ({ createdAt, id }: ChannelAuditEntry) => ({ sort: createdAt, tie: id });

/** One log shared by the member, invite and studio repositories, as the table is in postgres. */
export class InMemoryChannelAuditRepository implements ChannelAuditRepositoryPort {
  private rows: ChannelAuditEntry[] = [];

  async append(
    entry: NewChannelAuditEntry
  ): Promise<Result<ChannelAuditEntry, DatabaseUnavailable>> {
    const row: ChannelAuditEntry = { ...entry, id: uuidv7(), createdAt: new Date() };
    this.rows.push(row);
    return ok({ ...row });
  }

  async list(
    channelId: string,
    { cursor, limit, actorUserId, action }: ChannelAuditQuery
  ): Promise<Result<ChannelAuditEntry[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    return ok(
      this.rows
        .filter(
          (row) =>
            row.channelId === channelId &&
            (!actorUserId || row.actorUserId === actorUserId) &&
            (!action || row.action === action) &&
            isKeysetBefore(keysetOf(row), after)
        )
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  async purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => row.createdAt >= cutoff);
    return ok(before - this.rows.length);
  }

  clear(): void {
    this.rows = [];
  }
}
