import * as schema from '@vp/db';
import { type PlaylistCount, mergePlaylistCounts } from '@vp/domain';
import { inArray, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { playlists: p, videos: v, playlistStatsDaily: daily, playlistPlaysDaily: plays } = schema;

/**
 * Adds a batch's playlist counts: every count to its playlist's day, a play to its video's day in the
 * playlist too. A playlist or video deleted since the beacon is left out, as the view counts leave
 * out a deleted video.
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
  const kept = merged.filter(({ playlistId }) => knownPlaylists.has(playlistId));
  const videoIds = [...new Set(kept.flatMap(({ videoId }) => (videoId ? [videoId] : [])))];
  const knownVideos = new Set(
    videoIds.length === 0
      ? []
      : (await tx.select({ id: v.id }).from(v).where(inArray(v.id, videoIds))).map(({ id }) => id)
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
    videoId && knownVideos.has(videoId) && started > 0
      ? [{ playlistId, videoId, day: viewDate, plays: started }]
      : []
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
