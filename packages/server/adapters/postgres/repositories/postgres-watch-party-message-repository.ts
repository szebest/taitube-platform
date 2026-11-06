import type { NewWatchPartyMessage, WatchPartyMessageRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { WatchPartyMessage } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, ok, type Result } from '@vp/result';
import { and, asc, desc, eq, gt, gte, isNull, type SQL, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { lockRoom } from './watch-party-writes';

const { watchPartyMessages: m } = schema;

export class PostgresWatchPartyMessageRepository implements WatchPartyMessageRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async append(
    message: NewWatchPartyMessage
  ): Promise<Result<WatchPartyMessage, DatabaseUnavailable>> {
    const inserted = await fromPromise(
      () => this.db.insert(m).values(message),
      databaseUnavailable.during('appendWatchPartyMessage')
    );
    return map(inserted, () => ({ ...message, pinned: false, removedAt: null }));
  }

  async listAfter(
    roomId: string,
    afterId: string | null,
    limit: number
  ): Promise<Result<WatchPartyMessage[], DatabaseUnavailable>> {
    if (afterId !== null) {
      return this.select(and(eq(m.roomId, roomId), gt(m.id, afterId)), asc(m.id), limit);
    }
    const newest = await this.select(eq(m.roomId, roomId), desc(m.id), limit);
    return map(newest, (rows) => rows.reverse());
  }

  async listRemovedSince(
    roomId: string,
    afterId: string,
    limit: number
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const sentAt = this.db
      .select({ createdAt: m.createdAt })
      .from(m)
      .where(and(eq(m.id, afterId), eq(m.roomId, roomId)));
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: m.id })
          .from(m)
          .where(and(eq(m.roomId, roomId), gte(m.removedAt, sql`(${sentAt})`)))
          .orderBy(asc(m.removedAt), asc(m.id))
          .limit(limit),
      databaseUnavailable.during('listRemovedWatchPartyMessages')
    );
    return map(rows, (found) => found.map(({ id }) => id));
  }

  async remove(
    roomId: string,
    messageId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(m)
          .set({ removedAt: at })
          .where(and(eq(m.id, messageId), eq(m.roomId, roomId), isNull(m.removedAt)))
          .returning({ id: m.id }),
      databaseUnavailable.during('removeWatchPartyMessage')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  async pin(
    roomId: string,
    messageId: string | null
  ): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<WatchPartyMessage | null> => {
          if (!(await lockRoom(tx, roomId))) return null;
          await tx
            .update(m)
            .set({ pinned: false })
            .where(and(eq(m.roomId, roomId), eq(m.pinned, true)));
          if (messageId === null) return null;
          const [pinned] = await tx
            .update(m)
            .set({ pinned: true })
            .where(
              and(
                eq(m.id, messageId),
                eq(m.roomId, roomId),
                eq(m.kind, 'text'),
                isNull(m.removedAt)
              )
            )
            .returning();
          return pinned ?? null;
        }),
      databaseUnavailable.during('pinWatchPartyMessage')
    );
  }

  async findPinned(roomId: string): Promise<Result<WatchPartyMessage | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(m)
          .where(and(eq(m.roomId, roomId), eq(m.pinned, true), isNull(m.removedAt)))
          .limit(1),
      databaseUnavailable.during('findPinnedWatchPartyMessage')
    );
    return map(rows, ([row]) => row ?? null);
  }

  private async select(
    where: SQL | undefined,
    orderBy: SQL,
    limit: number
  ): Promise<Result<WatchPartyMessage[], DatabaseUnavailable>> {
    if (limit <= 0) return ok([]);
    return await fromPromise(
      () =>
        this.db
          .select()
          .from(m)
          .where(and(where, isNull(m.removedAt)))
          .orderBy(orderBy)
          .limit(limit),
      databaseUnavailable.during('listWatchPartyMessages')
    );
  }
}
