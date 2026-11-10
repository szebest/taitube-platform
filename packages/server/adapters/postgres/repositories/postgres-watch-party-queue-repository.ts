import type {
  NewSystemLine,
  NewWatchPartyQueueItem,
  QueueSnapshot,
  QueueWrite,
  WatchPartyQueueRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { appendPositions, type PositionWrite } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, type Result } from '@vp/result';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { bumpQueueVersion, insertSystemLine, lockRoom } from './watch-party-writes';

const { watchPartyQueueItems: q, watchPartyRooms: rooms } = schema;

const MISSING: QueueWrite = { type: 'missing' };
const FULL: QueueWrite = { type: 'full' };

async function snapshot(tx: PostgresDatabase, roomId: string): Promise<QueueSnapshot> {
  const [room] = await tx
    .select({ version: rooms.queueVersion })
    .from(rooms)
    .where(eq(rooms.id, roomId));
  const items = await tx
    .select()
    .from(q)
    .where(and(eq(q.roomId, roomId), isNull(q.removedAt)))
    .orderBy(asc(q.position), asc(q.id));
  return { items, version: room?.version ?? 0 };
}

async function applied(tx: PostgresDatabase, roomId: string): Promise<QueueWrite> {
  await bumpQueueVersion(tx, roomId);
  return { type: 'applied', queue: await snapshot(tx, roomId) };
}

async function writePositions(
  tx: PostgresDatabase,
  roomId: string,
  writes: readonly PositionWrite[]
): Promise<void> {
  if (writes.length === 0) return;
  const values = sql.join(
    writes.map((write) => sql`(${write.id}::uuid, ${write.position}::integer)`),
    sql`, `
  );
  await tx.execute(
    sql`update ${q} set position = moved.position from (values ${values}) as moved(id, position)
        where ${q.id} = moved.id and ${q.roomId} = ${roomId}`
  );
}

export class PostgresWatchPartyQueueRepository implements WatchPartyQueueRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async list(roomId: string): Promise<Result<QueueSnapshot, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction((tx) => snapshot(tx, roomId), {
          isolationLevel: 'repeatable read',
          accessMode: 'read only',
        }),
      databaseUnavailable.during('listWatchPartyQueue')
    );
  }

  async append(
    roomId: string,
    items: readonly NewWatchPartyQueueItem[],
    limit: number
  ): Promise<Result<QueueWrite, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<QueueWrite> => {
          if (!(await lockRoom(tx, roomId))) return MISSING;
          const live = await tx
            .select({ id: q.id, position: q.position, playedAt: q.playedAt })
            .from(q)
            .where(and(eq(q.roomId, roomId), isNull(q.removedAt)))
            .orderBy(asc(q.position), asc(q.id));
          const pending = live.filter((item) => item.playedAt === null).length;
          if (pending + items.length > limit) return FULL;

          const { renumber, positions } = appendPositions(live, items.length);
          await writePositions(tx, roomId, renumber);
          if (items.length > 0) {
            await tx
              .insert(q)
              .values(items.map((item, n) => ({ ...item, roomId, position: positions[n] ?? 0 })));
          }
          return await applied(tx, roomId);
        }),
      databaseUnavailable.during('appendWatchPartyQueue')
    );
  }

  async move(
    roomId: string,
    writes: readonly PositionWrite[]
  ): Promise<Result<QueueWrite, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<QueueWrite> => {
          if (!(await lockRoom(tx, roomId))) return MISSING;
          await writePositions(tx, roomId, writes);
          return await applied(tx, roomId);
        }),
      databaseUnavailable.during('moveWatchPartyQueue')
    );
  }

  async remove(
    roomId: string,
    itemId: string,
    line: NewSystemLine | null,
    at: Date
  ): Promise<Result<QueueWrite, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<QueueWrite> => {
          if (!(await lockRoom(tx, roomId))) return MISSING;
          const removed = await tx
            .update(q)
            .set({ removedAt: at })
            .where(and(eq(q.id, itemId), eq(q.roomId, roomId), isNull(q.removedAt)))
            .returning({ id: q.id });
          if (removed.length === 0) return MISSING;
          if (line) await insertSystemLine(tx, roomId, line);
          return await applied(tx, roomId);
        }),
      databaseUnavailable.during('removeWatchPartyQueueItem')
    );
  }

  async countPendingBy(
    roomId: string,
    memberKey: string
  ): Promise<Result<number, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(q)
          .where(
            and(
              eq(q.roomId, roomId),
              eq(q.addedBy, memberKey),
              isNull(q.playedAt),
              isNull(q.removedAt)
            )
          ),
      databaseUnavailable.during('countWatchPartyPendingBy')
    );
    return map(rows, ([row]) => row?.count ?? 0);
  }
}
