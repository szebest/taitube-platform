import { fromPromise, map, ok, type Result } from '@kit/result';
import type {
  ContentLinkDayCounts,
  ContentLinkStatCounts,
  ContentLinkStatsRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { inArray, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { contentLinkStatsDaily: stats, contentLinks: links } = schema;

function mergeDays(counts: readonly ContentLinkDayCounts[]): ContentLinkDayCounts[] {
  const merged = new Map<string, ContentLinkDayCounts>();
  for (const count of counts) {
    const key = `${count.linkId}:${count.day}`;
    const held = merged.get(key);
    merged.set(key, {
      ...count,
      impressions: (held?.impressions ?? 0) + count.impressions,
      clicks: (held?.clicks ?? 0) + count.clicks,
      watchSeconds: (held?.watchSeconds ?? 0) + count.watchSeconds,
    });
  }
  return [...merged.values()];
}

export class PostgresContentLinkStatsRepository implements ContentLinkStatsRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async addDaily(
    counts: readonly ContentLinkDayCounts[]
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (counts.length === 0) return ok();
    const written = await fromPromise(async () => {
      const existing = await this.db
        .select({ id: links.id })
        .from(links)
        .where(inArray(links.id, [...new Set(counts.map(({ linkId }) => linkId))]));
      const live = new Set(existing.map(({ id }) => id));
      const rows = mergeDays(counts.filter(({ linkId }) => live.has(linkId)));
      if (rows.length === 0) return;
      await this.db
        .insert(stats)
        .values(rows)
        .onConflictDoUpdate({
          target: [stats.linkId, stats.day],
          set: {
            impressions: sql`${stats.impressions} + excluded.impressions`,
            clicks: sql`${stats.clicks} + excluded.clicks`,
            watchSeconds: sql`${stats.watchSeconds} + excluded.watch_seconds`,
          },
        });
    }, databaseUnavailable.during('addContentLinkStats'));
    return map(written, () => undefined);
  }

  async totalsFor(
    linkIds: readonly string[]
  ): Promise<Result<Map<string, ContentLinkStatCounts>, DatabaseUnavailable>> {
    const totals = new Map<string, ContentLinkStatCounts>(
      linkIds.map((id) => [id, { impressions: 0, clicks: 0, watchSeconds: 0 }])
    );
    if (linkIds.length === 0) return ok(totals);
    const rows = await fromPromise(
      () =>
        this.db
          .select({
            linkId: stats.linkId,
            impressions: sql<number>`sum(${stats.impressions})::float8`,
            clicks: sql<number>`sum(${stats.clicks})::float8`,
            watchSeconds: sql<number>`sum(${stats.watchSeconds})::float8`,
          })
          .from(stats)
          .where(inArray(stats.linkId, [...linkIds]))
          .groupBy(stats.linkId),
      databaseUnavailable.during('contentLinkTotals')
    );
    return map(rows, (found) => {
      for (const { linkId, ...counts } of found) totals.set(linkId, counts);
      return totals;
    });
  }
}
