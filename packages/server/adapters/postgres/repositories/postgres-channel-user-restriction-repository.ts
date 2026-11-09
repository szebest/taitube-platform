import type {
  ChannelUserRestrictionQuery,
  ChannelUserRestrictionRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { ChannelUserRestriction, NewChannelUserRestriction } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { keysetBefore } from '../scopes/index';
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
    restriction: NewChannelUserRestriction
  ): Promise<Result<ChannelUserRestriction, DatabaseUnavailable>> {
    const createdAt = new Date();
    const rows = await fromPromise(
      () =>
        this.db
          .insert(r)
          .values({ ...restriction, createdAt })
          .onConflictDoUpdate({
            target: [r.channelId, r.userId],
            set: { ...restriction, createdAt },
          })
          .returning(),
      databaseUnavailable.during('applyRestriction')
    );
    return map(rows, ([row]) => row ?? { ...restriction, createdAt });
  }

  async lift(channelId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(r)
          .where(and(eq(r.channelId, channelId), eq(r.userId, userId)))
          .returning({ userId: r.userId }),
      databaseUnavailable.during('liftRestriction')
    );
    return map(rows, (lifted) => lifted.length > 0);
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
