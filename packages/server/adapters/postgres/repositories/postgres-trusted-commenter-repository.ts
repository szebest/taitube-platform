import type {
  TrustedCommenter,
  TrustedCommenterQuery,
  TrustedCommenterRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq } from 'drizzle-orm';
import { keysetBefore } from '../scopes/index';
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
    createdBy: string
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .insert(t)
          .values({ channelId, userId, createdBy })
          .onConflictDoNothing()
          .returning({ userId: t.userId }),
      databaseUnavailable.during('addTrustedCommenter')
    );
    return map(rows, (added) => added.length > 0);
  }

  async remove(channelId: string, userId: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(t)
          .where(and(eq(t.channelId, channelId), eq(t.userId, userId)))
          .returning({ userId: t.userId }),
      databaseUnavailable.during('removeTrustedCommenter')
    );
    return map(rows, (removed) => removed.length > 0);
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
