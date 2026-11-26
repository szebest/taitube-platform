import * as schema from '@vp/db';
import {
  type ViewBatch,
  type ViewBatchOutcome,
  mergeDeviceCounts,
  mergeExperimentCounts,
  mergeHourlyCounts,
  mergeShareLinkCounts,
  mergeViewCounts,
  viewsByVideo,
} from '@vp/domain';
import { eq, inArray, sql } from 'drizzle-orm';
import { applyAccessStats } from './access-stats-writes';
import type { PostgresDatabase } from './types';

const {
  videos: v,
  videoViewsDaily: d,
  videoViewsDeviceDaily: dev,
  videoViewsHourly: h,
  videoViewBatches: batches,
  videoRetentionMilestones: milestones,
} = schema;

/** Runs on the caller's transaction: the ledger row, the counters and every table the batch feeds commit or roll back together. */
export async function applyViewBatch(
  tx: PostgresDatabase,
  batch: ViewBatch
): Promise<ViewBatchOutcome> {
  const [claimed] = await tx
    .insert(batches)
    .values({ batchId: batch.batchId })
    .onConflictDoNothing()
    .returning({ batchId: batches.batchId });
  if (!claimed) return { type: 'already-applied' };

  const counts = mergeViewCounts(batch.counts);
  const hours = mergeHourlyCounts(batch.hourly);
  const devices = mergeDeviceCounts(batch.devices);
  const linkCounts = mergeShareLinkCounts(batch.shareLinks);
  const experimentCounts = mergeExperimentCounts(batch.experiments);
  const videoIds = [
    ...new Set([...counts, ...batch.retention, ...hours, ...devices].map(({ videoId }) => videoId)),
  ];

  await applyAccessStats(tx, linkCounts, experimentCounts);
  if (videoIds.length === 0) return { type: 'applied', views: 0 };

  const known = await tx.select({ id: v.id }).from(v).where(inArray(v.id, videoIds));
  const existing = new Set(known.map((row) => row.id));
  const kept = counts.filter((count) => existing.has(count.videoId));
  const keptRetention = batch.retention.filter((step) => existing.has(step.videoId));
  const keptHours = hours.filter((count) => existing.has(count.videoId));
  const keptDevices = devices.filter((count) => existing.has(count.videoId));

  const deltas = viewsByVideo(kept);
  if (deltas.length > 0) {
    const tuples = sql.join(
      deltas.map(({ videoId, views }) => sql`(${videoId}::uuid, ${views}::bigint)`),
      sql`, `
    );
    await tx
      .update(v)
      .set({ viewsCount: sql`${v.viewsCount} + b.delta` })
      .from(sql`(VALUES ${tuples}) AS b(video_id, delta)`)
      .where(eq(v.id, sql`b.video_id`));

    await tx
      .insert(d)
      .values([...kept])
      .onConflictDoUpdate({
        target: [d.videoId, d.viewDate],
        set: {
          views: sql`${d.views} + excluded.views`,
          watchSeconds: sql`${d.watchSeconds} + excluded.watch_seconds`,
        },
      });
  }

  if (keptDevices.length > 0) {
    await tx
      .insert(dev)
      .values([...keptDevices])
      .onConflictDoUpdate({
        target: [dev.videoId, dev.viewDate, dev.device],
        set: { views: sql`${dev.views} + excluded.views` },
      });
  }

  if (keptRetention.length > 0) {
    await tx
      .insert(milestones)
      .values([...keptRetention])
      .onConflictDoUpdate({
        target: [milestones.videoId, milestones.percent],
        set: { viewers: sql`${milestones.viewers} + excluded.viewers` },
      });
  }

  if (keptHours.length > 0) {
    await tx
      .insert(h)
      .values(keptHours.map((count) => ({ ...count, viewHour: new Date(count.viewHour) })))
      .onConflictDoUpdate({
        target: [h.videoId, h.viewHour],
        set: { views: sql`${h.views} + excluded.views` },
      });
  }

  return { type: 'applied', views: deltas.reduce((sum, delta) => sum + delta.views, 0) };
}
