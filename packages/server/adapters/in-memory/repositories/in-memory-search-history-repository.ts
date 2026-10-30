import type { ListSearchHistoryOptions, SearchHistoryRepositoryPort } from '@vp/core/repositories';
import {
  type NewSearchHistoryEntry,
  SEARCH_HISTORY_LIMIT,
  type SearchHistoryEntry,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { ok, type Result } from '@vp/result';
import { byKeysetDesc, isKeysetBefore } from './keyset';

const keysetOf = ({ searchedAt, id }: SearchHistoryEntry) => ({ sort: searchedAt, tie: id });

export class InMemorySearchHistoryRepository implements SearchHistoryRepositoryPort {
  private readonly rows = new Map<string, NewSearchHistoryEntry>();

  async record(entry: NewSearchHistoryEntry): Promise<Result<void, DatabaseUnavailable>> {
    const key = this.key(entry.userId, entry.queryKey);
    const stored = this.rows.get(key);
    this.rows.set(
      key,
      stored ? { ...stored, query: entry.query, searchedAt: entry.searchedAt } : { ...entry }
    );

    for (const stale of this.of(entry.userId).slice(SEARCH_HISTORY_LIMIT)) {
      this.rows.delete(this.key(stale.userId, stale.queryKey));
    }
    return ok();
  }

  async list(
    userId: string,
    { cursor, limit }: ListSearchHistoryOptions
  ): Promise<Result<SearchHistoryEntry[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.searchedAt, tie: cursor.id };
    return ok(
      this.of(userId)
        .filter((row) => isKeysetBefore(keysetOf(row), after))
        .slice(0, limit + 1)
        .map(({ id, query, searchedAt }) => ({ id, query, searchedAt }))
    );
  }

  async remove(userId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const found = this.of(userId).find((row) => row.id === id);
    return ok(found ? this.rows.delete(this.key(userId, found.queryKey)) : false);
  }

  async removeAll(userId: string): Promise<Result<void, DatabaseUnavailable>> {
    for (const row of this.of(userId)) this.rows.delete(this.key(userId, row.queryKey));
    return ok();
  }

  async purgeOlderThan(cutoff: Date): Promise<Result<number, DatabaseUnavailable>> {
    const stale = [...this.rows.entries()].filter(([, row]) => row.searchedAt < cutoff);
    for (const [key] of stale) this.rows.delete(key);
    return ok(stale.length);
  }

  clear(): void {
    this.rows.clear();
  }

  private of(userId: string): NewSearchHistoryEntry[] {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)));
  }

  private key(userId: string, queryKey: string): string {
    return `${userId}/${queryKey}`;
  }
}
