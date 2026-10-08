import type {
  SearchHit,
  SearchPage,
  SearchQuery,
  SearchRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type Channel, type SearchResultKind, compareSearchPositions } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { type Result, all, andThen, fromPromise, map, ok } from '@vp/result';
import { desc, or, sql } from 'drizzle-orm';
import { restrictsQuery } from './search-query';
import { type SearchSource, channelSource, playlistSource, videoSource } from './search-sources';
import type { PostgresDatabase } from './types';

const { channels: ch } = schema;

const SOURCES: Record<SearchResultKind, (query: SearchQuery) => SearchSource> = {
  video: videoSource,
  channel: channelSource,
  playlist: playlistSource,
};

interface KindPage {
  hits: SearchHit[];
  total: number;
}

function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (special) => `\\${special}`)}%`;
}

/**
 * One query per kind, run side by side, each already in the merged order and cut at the window,
 * so the merge only interleaves and trims. Every kind reads through its public scope.
 */
export class PostgresSearchRepository implements SearchRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async search(query: SearchQuery): Promise<Result<SearchPage, DatabaseUnavailable>> {
    const pages = all(await Promise.all(query.kinds.map((kind) => this.kindPage(kind, query))));

    return map(pages, (kinds) => ({
      hits: kinds
        .flatMap((page) => page.hits)
        .sort(compareSearchPositions)
        .slice(0, query.limit + 1),
      total: kinds.reduce((sum, page) => sum + page.total, 0),
    }));
  }

  async restricts(text: string): Promise<Result<boolean, DatabaseUnavailable>> {
    if (!text.includes('-')) return ok(true);
    const rows = await fromPromise(
      () =>
        this.db
          .select({ restricts: sql<boolean>`${restrictsQuery(text)}`.mapWith(Boolean) })
          .from(sql`(select 1) as probe`),
      databaseUnavailable.during('searchRestricts')
    );
    return map(rows, ([row]) => row?.restricts ?? false);
  }

  async suggestChannels(
    prefix: string,
    limit: number
  ): Promise<Result<Channel[], DatabaseUnavailable>> {
    const pattern = likePrefix(prefix);
    return fromPromise(
      () =>
        this.db
          .select()
          .from(ch)
          .where(
            or(
              sql`lower(${ch.handle}) like ${pattern}`,
              sql`lower(${ch.displayName}) like ${pattern}`
            )
          )
          .orderBy(desc(ch.subscriberCount), desc(ch.id))
          .limit(limit),
      databaseUnavailable.during('suggestChannels')
    );
  }

  private async kindPage(
    kind: SearchResultKind,
    query: SearchQuery
  ): Promise<Result<KindPage, DatabaseUnavailable>> {
    const source = SOURCES[kind](query);
    const [hits, total] = await Promise.all([
      fromPromise(() => source.hits(this.db), databaseUnavailable.during('search')),
      fromPromise(() => source.total(this.db), databaseUnavailable.during('searchTotal')),
    ]);
    return andThen(hits, (found) => map(total, (matched) => ({ hits: found, total: matched })));
  }
}
