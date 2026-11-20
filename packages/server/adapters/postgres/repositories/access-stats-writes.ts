import * as schema from '@vp/db';
import type { ExperimentCount, ShareLinkCount } from '@vp/domain';
import { inArray, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const {
  shareLinks: links,
  shareLinkStats: linkStats,
  videoExperiments: experiments,
  videoExperimentStats: experimentStats,
} = schema;

/** Adds the day's share link and test numbers, leaving out a link or test deleted since the beacon. */
export async function applyAccessStats(
  tx: PostgresDatabase,
  linkCounts: readonly ShareLinkCount[],
  experimentCounts: readonly ExperimentCount[]
): Promise<void> {
  if (linkCounts.length > 0) {
    const known = await tx
      .select({ id: links.id })
      .from(links)
      .where(inArray(links.id, [...new Set(linkCounts.map(({ linkId }) => linkId))]));
    const existing = new Set(known.map((row) => row.id));
    const kept = linkCounts
      .filter(({ linkId }) => existing.has(linkId))
      .map(({ viewDate, ...count }) => ({ ...count, day: viewDate }));
    if (kept.length > 0) {
      await tx
        .insert(linkStats)
        .values(kept)
        .onConflictDoUpdate({
          target: [linkStats.linkId, linkStats.day],
          set: {
            opens: sql`${linkStats.opens} + excluded.opens`,
            views: sql`${linkStats.views} + excluded.views`,
            watchSeconds: sql`${linkStats.watchSeconds} + excluded.watch_seconds`,
          },
        });
    }
  }

  if (experimentCounts.length > 0) {
    const known = await tx
      .select({ id: experiments.id })
      .from(experiments)
      .where(
        inArray(experiments.id, [
          ...new Set(experimentCounts.map(({ experimentId }) => experimentId)),
        ])
      );
    const existing = new Set(known.map((row) => row.id));
    const kept = experimentCounts
      .filter(({ experimentId }) => existing.has(experimentId))
      .map(({ viewDate, ...count }) => ({ ...count, day: viewDate }));
    if (kept.length > 0) {
      await tx
        .insert(experimentStats)
        .values(kept)
        .onConflictDoUpdate({
          target: [experimentStats.experimentId, experimentStats.variantId, experimentStats.day],
          set: {
            impressions: sql`${experimentStats.impressions} + excluded.impressions`,
            starts: sql`${experimentStats.starts} + excluded.starts`,
            watchSeconds: sql`${experimentStats.watchSeconds} + excluded.watch_seconds`,
          },
        });
    }
  }
}
