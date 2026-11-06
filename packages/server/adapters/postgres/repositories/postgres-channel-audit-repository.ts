import type { ChannelAuditQuery, ChannelAuditRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ChannelAuditEntry, NewChannelAuditEntry } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, lt } from 'drizzle-orm';
import { keysetBefore } from '../scopes/index';
import { appendChannelAudit, toChannelAuditEntry } from './channel-audit-writes';
import type { PostgresDatabase } from './types';

const { channelAuditLog: log } = schema;

export class PostgresChannelAuditRepository implements ChannelAuditRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async append(
    entry: NewChannelAuditEntry
  ): Promise<Result<ChannelAuditEntry, DatabaseUnavailable>> {
    return fromPromise(
      () => appendChannelAudit(this.db, entry),
      databaseUnavailable.during('appendChannelAudit')
    );
  }

  async list(
    channelId: string,
    { cursor, limit, actorUserId, action }: ChannelAuditQuery
  ): Promise<Result<ChannelAuditEntry[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(log)
          .where(
            and(
              eq(log.channelId, channelId),
              actorUserId ? eq(log.actorUserId, actorUserId) : undefined,
              action ? eq(log.action, action) : undefined,
              keysetBefore(
                log.createdAt,
                log.id,
                cursor && { sort: cursor.createdAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(log.createdAt), desc(log.id))
          .limit(limit + 1),
      databaseUnavailable.during('listChannelAudit')
    );
    return map(rows, (found) => found.map(toChannelAuditEntry));
  }

  async purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(log).where(lt(log.createdAt, cutoff)).returning({ id: log.id }),
      databaseUnavailable.during('purgeChannelAudit')
    );
    return map(rows, (purged) => purged.length);
  }
}
