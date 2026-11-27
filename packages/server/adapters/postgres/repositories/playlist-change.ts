import * as schema from '@vp/db';
import {
  type NewPlaylistActivity,
  type PlaylistActivity,
  type PlaylistActivityEntry,
  coalescesWith,
  playlistAudience,
  playlistUpdateHour,
  playlistUpdated,
} from '@vp/domain';
import { playlistUpdateOutbox } from '@vp/job-contracts';
import { desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { playlists: p, playlistCollaborators: pc, playlistActivity: pa } = schema;

type ActivityRow = typeof pa.$inferSelect;

/** Rows are written only through `recordPlaylistChange`, so each `target` matches its `action`. */
export function toPlaylistActivity(row: ActivityRow): PlaylistActivity {
  const { action, target, ...rest } = row;
  return { ...rest, ...({ action, target } as PlaylistActivityEntry) };
}

async function writeActivity(
  tx: PostgresDatabase,
  entry: NewPlaylistActivity,
  now: Date
): Promise<void> {
  if (entry.action === 'items_reordered') {
    const [latest] = await tx
      .select()
      .from(pa)
      .where(eq(pa.playlistId, entry.playlistId))
      .orderBy(desc(pa.createdAt), desc(pa.id))
      .limit(1);
    if (latest && coalescesWith(toPlaylistActivity(latest), entry, now)) {
      await tx.update(pa).set({ createdAt: now }).where(eq(pa.id, latest.id));
      return;
    }
  }
  await tx.insert(pa).values({ ...entry, createdAt: now });
}

/**
 * The bookkeeping of a playlist write, on its transaction: the activity rows, `playlist.updated`
 * to everyone else on the playlist, and the owner's notification when someone else made the change.
 */
export async function recordPlaylistChange(
  tx: PostgresDatabase,
  playlistId: string,
  actorId: string,
  entries: readonly PlaylistActivityEntry[]
): Promise<void> {
  if (entries.length === 0) return;
  const now = new Date();
  for (const entry of entries) {
    await writeActivity(tx, { ...entry, id: uuidv7(), playlistId, actorUserId: actorId }, now);
  }

  const [playlist] = await tx.select({ ownerId: p.ownerId }).from(p).where(eq(p.id, playlistId));
  if (!playlist) return;
  const seats = await tx.select({ userId: pc.userId }).from(pc).where(eq(pc.playlistId, playlistId));
  const audience = playlistAudience(
    playlist.ownerId,
    seats.map((seat) => seat.userId),
    actorId
  );
  for (const userId of audience) {
    await appendUserEvent(tx, { userId, ...playlistUpdated(playlistId) });
  }
  if (actorId !== playlist.ownerId) {
    await enqueueNotificationJobs(tx, [
      playlistUpdateOutbox({ playlistId, actorUserId: actorId, hour: playlistUpdateHour(now) }),
    ]);
  }
}
