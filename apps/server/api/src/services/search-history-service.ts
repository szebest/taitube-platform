import type { SearchHistoryItemView } from '@vp/api-contracts';
import type { SearchHistoryRepositoryPort } from '@vp/core/repositories';
import { type SearchHistoryNotFound, decideSearchHistoryRemoval } from '@vp/domain-rules';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, andThen, isErr, map } from '@vp/result';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface SearchHistoryServiceDeps {
  history: SearchHistoryRepositoryPort;
  paginator: Paginator;
}

interface SearchHistoryPage {
  items: SearchHistoryItemView[];
  nextCursor: string | null;
}

/** The caller's own trail: every read and delete is keyed by their id, so no one else's row is reachable. */
export class SearchHistoryService {
  constructor(private readonly deps: SearchHistoryServiceDeps) {}

  async list(
    viewer: UserContext,
    query: { cursor?: string; limit?: number }
  ): Promise<Result<SearchHistoryPage, DatabaseUnavailable | InvalidCursor>> {
    const { paginator } = this.deps;
    const limit = paginator.limit(query.limit);
    const cursor = decodeCreatedAtCursor(query.cursor, paginator);
    if (isErr(cursor)) return cursor;

    const rows = await this.deps.history.list(viewer.id, {
      cursor: cursor.value && { searchedAt: cursor.value.createdAt, id: cursor.value.id },
      limit,
    });
    return map(rows, (entries) =>
      paginator.paginate(entries, limit, {
        cursorOf: ({ searchedAt, id }) => createdAtCursorPayload({ createdAt: searchedAt, id }),
        toItem: ({ id, query: text, searchedAt }): SearchHistoryItemView => ({
          id,
          query: text,
          searchedAt: searchedAt.toISOString(),
        }),
      })
    );
  }

  async remove(
    viewer: UserContext,
    entryId: string
  ): Promise<Result<void, DatabaseUnavailable | SearchHistoryNotFound>> {
    const removed = await this.deps.history.remove(viewer.id, entryId);
    return andThen(removed, (found) => decideSearchHistoryRemoval({ entryId, removed: found }));
  }

  async clear(viewer: UserContext): Promise<Result<void, DatabaseUnavailable>> {
    return this.deps.history.removeAll(viewer.id);
  }
}
