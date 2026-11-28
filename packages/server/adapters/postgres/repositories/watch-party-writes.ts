import { fromPromise, type Result } from '@kit/result';
import type { NewOutboxInput, NewSystemLine, RoomWrite } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { WatchPartyRoom } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const {
  watchPartyRooms: rooms,
  watchPartyMessages: messages,
  watchPartyQueueItems: queue,
  outbox,
} = schema;

/** The room as the domain knows it: without the columns only discovery reads. */
export function toRoom(row: typeof rooms.$inferSelect): WatchPartyRoom {
  const { trendScore: _trendScore, searchText: _searchText, ...room } = row;
  return room;
}

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

/** On the caller's transaction, so the jobs exist exactly when their cause committed. */
export async function insertOutbox(
  tx: PostgresDatabase,
  items: readonly NewOutboxInput[]
): Promise<void> {
  if (items.length === 0) return;
  await tx.insert(outbox).values(
    items.map(({ id, kind, payload }) => ({
      id: id || sql`gen_random_uuid()`,
      kind,
      payload,
      createdAt: new Date(),
      attempts: 0,
    }))
  );
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

/** One compare-and-set in a transaction; the system line and the outbox rows are written only when it applied. */
export async function writeRoom(
  db: PostgresDatabase,
  operation: string,
  id: string,
  line: NewSystemLine | null,
  update: (tx: PostgresDatabase) => Promise<(typeof rooms.$inferSelect)[]>,
  outbound: readonly NewOutboxInput[] = []
): Promise<Result<RoomWrite, DatabaseUnavailable>> {
  return fromPromise(
    () =>
      db.transaction(async (tx): Promise<RoomWrite> => {
        const [applied] = await update(tx);
        if (applied) {
          if (line) await insertSystemLine(tx, id, line);
          await insertOutbox(tx, outbound);
          return { type: 'applied', room: toRoom(applied) };
        }
        const [current] = await tx.select().from(rooms).where(eq(rooms.id, id));
        return current ? { type: 'stale', room: toRoom(current) } : { type: 'missing' };
      }),
    databaseUnavailable.during(operation)
  );
}
