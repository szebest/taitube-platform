import * as schema from '@vp/db';
import { type PlaylistCount, mergePlaylistCounts } from '@vp/domain';
import { and, inArray, isNotNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const {
  playlists: p,
  playlistItems: items,
  playlistStatsDaily: daily,
  playlistPlaysDaily: plays,
} = schema;

/**
 * Adds a batch's playlist counts: every count to its playlist's day, a play to its video's day in the
 * playlist too. A playlist deleted since the beacon is left out, as the view counts leave out a
 * deleted video, and so is a play of a video the playlist does not hold: the beacon is unauthenticated.
 */
export async function applyPlaylistStats(
  tx: PostgresDatabase,
  counts: readonly PlaylistCount[]
): Promise<void> {
  const merged = mergePlaylistCounts(counts);
  if (merged.length === 0) return;

  const playlistIds = [...new Set(merged.map(({ playlistId }) => playlistId))];
  const knownPlaylists = new Set(
    (await tx.select({ id: p.id }).from(p).where(inArray(p.id, playlistIds))).map(({ id }) => id)
  );
  const held = new Set(
    (
      await tx
        .select({ playlistId: items.playlistId, videoId: items.videoId })
        .from(items)
        .where(and(inArray(items.playlistId, playlistIds), isNotNull(items.videoId)))
    ).map(({ playlistId, videoId }) => `${playlistId}:${videoId}`)
  );
  const kept = merged.filter(
    ({ playlistId, videoId }) =>
      knownPlaylists.has(playlistId) && (videoId === null || held.has(`${playlistId}:${videoId}`))
  );

  const days = mergePlaylistCounts(kept.map((count) => ({ ...count, videoId: null })));
  if (days.length > 0) {
    await tx
      .insert(daily)
      .values(days.map(({ videoId: _, viewDate, ...count }) => ({ ...count, day: viewDate })))
      .onConflictDoUpdate({
        target: [daily.playlistId, daily.day],
        set: {
          opens: sql`${daily.opens} + excluded.opens`,
          plays: sql`${daily.plays} + excluded.plays`,
          follows: sql`${daily.follows} + excluded.follows`,
          forks: sql`${daily.forks} + excluded.forks`,
        },
      });
  }

  const videoDays = kept.flatMap(({ playlistId, videoId, viewDate, plays: started }) =>
    videoId && started > 0 ? [{ playlistId, videoId, day: viewDate, plays: started }] : []
  );
  if (videoDays.length > 0) {
    await tx
      .insert(plays)
      .values(videoDays)
      .onConflictDoUpdate({
        target: [plays.playlistId, plays.videoId, plays.day],
        set: { plays: sql`${plays.plays} + excluded.plays` },
      });
  }
}
