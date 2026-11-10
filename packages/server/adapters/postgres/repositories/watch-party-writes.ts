import type { NewSystemLine } from '@vp/core/repositories';
import * as schema from '@vp/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const {
  watchPartyRooms: rooms,
  watchPartyMessages: messages,
  watchPartyQueueItems: queue,
} = schema;

/** Serialises the room's writes for the rest of the transaction; `false` when the room is gone. */
export async function lockRoom(tx: PostgresDatabase, roomId: string): Promise<boolean> {
  const [room] = await tx
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .for('update');
  return room !== undefined;
}

/** On the caller's transaction, so the line exists exactly when its cause committed. */
export async function insertSystemLine(
  tx: PostgresDatabase,
  roomId: string,
  { id, line, videoId, positionMs, createdAt }: NewSystemLine
): Promise<void> {
  await tx.insert(messages).values({
    id,
    roomId,
    authorKey: null,
    kind: 'system',
    body: '',
    system: line,
    videoId,
    positionMs,
    createdAt,
  });
}

/** The fencing token every role change moves; `null` when the room is gone. */
export async function bumpRolesVersion(
  tx: PostgresDatabase,
  roomId: string,
  at: Date
): Promise<number | null> {
  const [row] = await tx
    .update(rooms)
    .set({ rolesVersion: sql`${rooms.rolesVersion} + 1`, updatedAt: at })
    .where(eq(rooms.id, roomId))
    .returning({ rolesVersion: rooms.rolesVersion });
  return row?.rolesVersion ?? null;
}

/** Recounts the room's queue and moves its version, after any queue edit. */
export async function bumpQueueVersion(
  tx: PostgresDatabase,
  roomId: string
): Promise<number | null> {
  const length = tx
    .select({ count: sql<number>`count(*)::int` })
    .from(queue)
    .where(and(eq(queue.roomId, roomId), isNull(queue.removedAt)));
  const [row] = await tx
    .update(rooms)
    .set({ queueVersion: sql`${rooms.queueVersion} + 1`, queueLength: sql`(${length})` })
    .where(eq(rooms.id, roomId))
    .returning({ queueVersion: rooms.queueVersion });
  return row?.queueVersion ?? null;
}
