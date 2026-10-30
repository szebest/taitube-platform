import type { ListSearchHistoryOptions, SearchHistoryRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type NewSearchHistoryEntry,
  SEARCH_HISTORY_LIMIT,
  type SearchHistoryEntry,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { keysetBefore } from '../scopes/index';
import type { PostgresDatabase } from './types';

const { searchHistory: sh } = schema;

export class PostgresSearchHistoryRepository implements SearchHistoryRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async record({
    id,
    userId,
    query,
    queryKey,
    searchedAt,
  }: NewSearchHistoryEntry): Promise<Result<void, DatabaseUnavailable>> {
    const written = await fromPromise(
      () =>
        this.db.execute(sql`
          with upserted as (
            insert into search_history (id, user_id, query_key, query, searched_at)
            values (${id}, ${userId}, ${queryKey}, ${query}, ${searchedAt})
            on conflict (user_id, query_key)
            do update set query = excluded.query, searched_at = excluded.searched_at
          )
          delete from search_history
          where id in (
            select id from search_history
            where user_id = ${userId} and query_key <> ${queryKey}
            order by searched_at desc, id desc
            offset ${SEARCH_HISTORY_LIMIT - 1}
          )
        `),
      databaseUnavailable.during('recordSearchHistory')
    );
    return map(written, () => undefined);
  }

  async list(
    userId: string,
    { cursor, limit }: ListSearchHistoryOptions
  ): Promise<Result<SearchHistoryEntry[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select({ id: sh.id, query: sh.query, searchedAt: sh.searchedAt })
          .from(sh)
          .where(
            and(
              eq(sh.userId, userId),
              keysetBefore(
                sh.searchedAt,
                sh.id,
                cursor && { sort: cursor.searchedAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(sh.searchedAt), desc(sh.id))
          .limit(limit + 1),
      databaseUnavailable.during('listSearchHistory')
    );
  }

  async remove(userId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .delete(sh)
          .where(and(eq(sh.userId, userId), eq(sh.id, id)))
          .returning({ id: sh.id }),
      databaseUnavailable.during('removeSearchHistory')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  async removeAll(userId: string): Promise<Result<void, DatabaseUnavailable>> {
    const cleared = await fromPromise(
      () => this.db.delete(sh).where(eq(sh.userId, userId)),
      databaseUnavailable.during('clearSearchHistory')
    );
    return map(cleared, () => undefined);
  }

  async purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.delete(sh).where(lt(sh.searchedAt, cutoff)).returning({ id: sh.id }),
      databaseUnavailable.during('purgeSearchHistory')
    );
    return map(rows, (purged) => purged.length);
  }
}
