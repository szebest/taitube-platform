import type {
  ChannelUserRestrictionQuery,
  ChannelUserRestrictionRepositoryPort,
  RestrictionLifted,
  RestrictionWritten,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type {
  ChannelUserRestriction,
  ModerationRecord,
  NewChannelAuditEntry,
  NewChannelUserRestriction,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { keysetBefore } from '../scopes/index';
import { appendChannelAudit, appendModerationRecord } from './channel-audit-writes';
import { recountAuthored } from './comment-recount';
import type { PostgresDatabase } from './types';

const { channelUserRestrictions: r } = schema;

const activeAt = (now: Date) => or(isNull(r.expiresAt), gt(r.expiresAt, now));

export class PostgresChannelUserRestrictionRepository implements ChannelUserRestrictionRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async findActive(
    channelId: string,
    userId: string,
    now: Date
  ): Promise<Result<ChannelUserRestriction | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(r)
          .where(and(eq(r.channelId, channelId), eq(r.userId, userId), activeAt(now)))
          .limit(1),
      databaseUnavailable.during('findActiveRestriction')
    );
    return map(rows, ([row]) => row ?? null);
  }

  async apply(
    restriction: NewChannelUserRestriction,
    record?: ModerationRecord
  ): Promise<Result<RestrictionWritten, DatabaseUnavailable>> {
    const createdAt = new Date();
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(r)
            .values({ ...restriction, createdAt })
            .onConflictDoUpdate({
              target: [r.channelId, r.userId],
              set: { ...restriction, createdAt },
            })
            .returning();
          const videoIds = await recountAuthored(tx, restriction.channelId, restriction.userId);
          if (record) await appendModerationRecord(tx, record);
          return { restriction: row ?? { ...restriction, createdAt }, videoIds };
        }),
      databaseUnavailable.during('applyRestriction')
    );
  }

  async lift(
    channelId: string,
    userId: string,
    audit?: NewChannelAuditEntry
  ): Promise<Result<RestrictionLifted, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const removed = await tx
            .delete(r)
            .where(and(eq(r.channelId, channelId), eq(r.userId, userId)))
            .returning({ userId: r.userId });
          if (removed.length === 0) return { lifted: false, videoIds: [] };

          const videoIds = await recountAuthored(tx, channelId, userId);
          if (audit) await appendChannelAudit(tx, audit);
          return { lifted: true, videoIds };
        }),
      databaseUnavailable.during('liftRestriction')
    );
  }

  async list(
    channelId: string,
    { cursor, limit, now }: ChannelUserRestrictionQuery
  ): Promise<Result<ChannelUserRestriction[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(r)
          .where(
            and(
              eq(r.channelId, channelId),
              activeAt(now),
              keysetBefore(
                r.createdAt,
                r.userId,
                cursor && { sort: cursor.createdAt, tie: cursor.userId }
              )
            )
          )
          .orderBy(desc(r.createdAt), desc(r.userId))
          .limit(limit + 1),
      databaseUnavailable.during('listRestrictions')
    );
  }

  async purgeEndedBefore(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(r).where(lt(r.expiresAt, cutoff)).returning({ userId: r.userId }),
      databaseUnavailable.during('purgeRestrictions')
    );
    return map(rows, (purged) => purged.length);
  }
}
