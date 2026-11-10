import type {
  TrustedCommenter,
  TrustedCommenterQuery,
  TrustedCommenterRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { NewChannelAuditEntry } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq } from 'drizzle-orm';
import { keysetBefore } from '../scopes/index';
import { appendChannelAudit } from './channel-audit-writes';
import type { PostgresDatabase } from './types';

const { channelTrustedCommenters: t } = schema;

export class PostgresTrustedCommenterRepository implements TrustedCommenterRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async isTrusted(
    channelId: string,
    userId: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ userId: t.userId })
          .from(t)
          .where(and(eq(t.channelId, channelId), eq(t.userId, userId)))
          .limit(1),
      databaseUnavailable.during('isTrustedCommenter')
    );
    return map(rows, (found) => found.length > 0);
  }

  async add(
    channelId: string,
    userId: string,
    createdBy: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const added = await tx
            .insert(t)
            .values({ channelId, userId, createdBy })
            .onConflictDoNothing()
            .returning({ userId: t.userId });
          if (added.length > 0 && audit) await appendChannelAudit(tx, audit);
          return added.length > 0;
        }),
      databaseUnavailable.during('addTrustedCommenter')
    );
  }

  async remove(
    channelId: string,
    userId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const removed = await tx
            .delete(t)
            .where(and(eq(t.channelId, channelId), eq(t.userId, userId)))
            .returning({ userId: t.userId });
          if (removed.length > 0 && audit) await appendChannelAudit(tx, audit);
          return removed.length > 0;
        }),
      databaseUnavailable.during('removeTrustedCommenter')
    );
  }

  async list(
    channelId: string,
    { cursor, limit }: TrustedCommenterQuery
  ): Promise<Result<TrustedCommenter[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(t)
          .where(
            and(
              eq(t.channelId, channelId),
              keysetBefore(
                t.createdAt,
                t.userId,
                cursor && { sort: cursor.createdAt, tie: cursor.userId }
              )
            )
          )
          .orderBy(desc(t.createdAt), desc(t.userId))
          .limit(limit + 1),
      databaseUnavailable.during('listTrustedCommenters')
    );
  }
}
