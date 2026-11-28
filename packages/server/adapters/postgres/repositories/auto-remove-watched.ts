import * as schema from '@vp/db';
import { type WatchProgress, isWatchCompleted } from '@vp/domain';
import { and, eq, notExists } from 'drizzle-orm';
import { recordPlaylistChange } from './playlist-change';
import { deleteRow, lockPlaylist, removedOf, touchPlaylist } from './playlist-item-writes';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistItems: pi, playlistCollaborators: pc } = schema;

/**
 * On the history write's transaction: a video the owner has now watched leaves each list of theirs
 * that removes watched videos and that nobody else works on, logged so the owner can restore it.
 */
export async function removeWatched(
  tx: PostgresDatabase,
  userId: string,
  progress: WatchProgress
): Promise<void> {
  if (!isWatchCompleted(progress)) return;
  const lists = await tx
    .select({ playlistId: p.id })
    .from(p)
    .innerJoin(pi, and(eq(pi.playlistId, p.id), eq(pi.videoId, progress.videoId)))
    .where(
      and(
        eq(p.ownerId, userId),
        eq(p.autoRemoveWatched, true),
        notExists(tx.select({ userId: pc.userId }).from(pc).where(eq(pc.playlistId, p.id)))
      )
    );
  for (const { playlistId } of lists) {
    if (!(await lockPlaylist(tx, playlistId))) continue;
    const removed = await deleteRow(tx, playlistId, { by: 'video', videoId: progress.videoId });
    if (!removed) continue;
    await touchPlaylist(tx, playlistId);
    await recordPlaylistChange(tx, playlistId, userId, [
      { action: 'auto_removed', target: removedOf(removed) },
    ]);
  }
}
