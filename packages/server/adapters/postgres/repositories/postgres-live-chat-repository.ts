import type { LiveChatOffsetRange, LiveChatRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { LiveChatMessage, NewLiveChatMessage } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { andThenAsync, fromPromise, map, ok, type Result } from '@vp/result';
import { and, asc, desc, eq, gt, gte, isNull, lt, type SQL, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const { liveChatMessages: m, channels: ch } = schema;

const columns = {
  id: m.id,
  liveStreamId: m.liveStreamId,
  userId: m.userId,
  message: m.message,
  offsetMs: m.offsetMs,
  createdAt: m.createdAt,
  handle: ch.handle,
  displayName: ch.displayName,
  avatarUrl: ch.avatarUrl,
};

type Row = {
  id: string;
  liveStreamId: string;
  userId: string;
  message: string;
  offsetMs: number;
  createdAt: Date;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

function toMessage({ userId, handle, displayName, avatarUrl, ...row }: Row): LiveChatMessage {
  return { ...row, author: { userId, handle, displayName, avatarUrl } };
}

export class PostgresLiveChatRepository implements LiveChatRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async append(message: NewLiveChatMessage): Promise<Result<LiveChatMessage, DatabaseUnavailable>> {
    const inserted = await fromPromise(
      () => this.db.insert(m).values(message),
      databaseUnavailable.during('appendLiveChatMessage')
    );
    return andThenAsync(inserted, async () => {
      const authors = await fromPromise(
        () =>
          this.db
            .select({ handle: ch.handle, displayName: ch.displayName, avatarUrl: ch.avatarUrl })
            .from(ch)
            .where(eq(ch.userId, message.userId))
            .limit(1),
        databaseUnavailable.during('appendLiveChatMessage')
      );
      return map(authors, ([author]) =>
        toMessage({ ...message, handle: null, displayName: null, avatarUrl: null, ...author })
      );
    });
  }

  async listAfter(
    liveStreamId: string,
    afterId: string | null,
    limit: number
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>> {
    if (afterId !== null) {
      return this.select(
        'listLiveChatAfter',
        and(eq(m.liveStreamId, liveStreamId), gt(m.id, afterId)),
        [asc(m.id)],
        limit
      );
    }
    const newest = await this.select(
      'listLiveChatAfter',
      eq(m.liveStreamId, liveStreamId),
      [desc(m.id)],
      limit
    );
    return map(newest, (rows) => rows.reverse());
  }

  async listByOffset(
    liveStreamId: string,
    { fromMs, toMs, limit }: LiveChatOffsetRange
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>> {
    return this.select(
      'listLiveChatByOffset',
      and(eq(m.liveStreamId, liveStreamId), gte(m.offsetMs, fromMs), lt(m.offsetMs, toMs)),
      [asc(m.offsetMs), asc(m.id)],
      limit
    );
  }

  async listRemovedSince(
    liveStreamId: string,
    afterId: string,
    limit: number
  ): Promise<Result<string[], DatabaseUnavailable>> {
    const sentAt = this.db
      .select({ createdAt: m.createdAt })
      .from(m)
      .where(and(eq(m.id, afterId), eq(m.liveStreamId, liveStreamId)));
    const rows = await fromPromise(
      () =>
        this.db
          .select({ id: m.id })
          .from(m)
          .where(and(eq(m.liveStreamId, liveStreamId), gte(m.removedAt, sql`(${sentAt})`)))
          .orderBy(asc(m.removedAt), asc(m.id))
          .limit(limit),
      databaseUnavailable.during('listRemovedLiveChat')
    );
    return map(rows, (found) => found.map(({ id }) => id));
  }

  async remove(
    liveStreamId: string,
    messageId: string,
    at: Date
  ): Promise<Result<boolean, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(m)
          .set({ removedAt: at })
          .where(and(eq(m.id, messageId), eq(m.liveStreamId, liveStreamId), isNull(m.removedAt)))
          .returning({ id: m.id }),
      databaseUnavailable.during('removeLiveChatMessage')
    );
    return map(rows, (removed) => removed.length > 0);
  }

  private async select(
    operation: string,
    where: SQL | undefined,
    orderBy: SQL[],
    limit: number
  ): Promise<Result<LiveChatMessage[], DatabaseUnavailable>> {
    if (limit <= 0) return ok([]);
    const rows = await fromPromise(
      () =>
        this.db
          .select(columns)
          .from(m)
          .leftJoin(ch, eq(ch.userId, m.userId))
          .where(and(where, isNull(m.removedAt)))
          .orderBy(...orderBy)
          .limit(limit),
      databaseUnavailable.during(operation)
    );
    return map(rows, (found) => found.map(toMessage));
  }
}
