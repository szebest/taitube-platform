import type {
  ListNotificationsOptions,
  MarkedRead,
  NotificationRepositoryPort,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  foldNotification,
  kindsOfFilter,
  type NewNotificationInput,
  NOTIFICATION_GROUP_WINDOW_MS,
  type Notification,
  type NotificationReadScope,
  notificationCreated,
  notificationRead,
  toNotificationView,
} from '@vp/domain';
import { MS_PER_DAY } from '@vp/domain/time';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, map, ok, type Result } from '@vp/result';
import { and, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { drizzleWhere, keysetBefore } from '../scopes/index';
import { appendUserEvent, lockUserEvents } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { notifications: n } = schema;

async function unreadCountOf(tx: PostgresDatabase, userId: string): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(n)
    .where(and(eq(n.userId, userId), isNull(n.readAt)));
  return row?.count ?? 0;
}

export class PostgresNotificationRepository implements NotificationRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async record(
    input: NewNotificationInput
  ): Promise<Result<Notification | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await lockUserEvents(tx, input.userId);
          const now = new Date();
          const windowStart = new Date(now.getTime() - NOTIFICATION_GROUP_WINDOW_MS);

          if (input.groupKey) {
            const [seen] = await tx
              .select({ id: n.id })
              .from(n)
              .where(
                and(
                  eq(n.userId, input.userId),
                  eq(n.groupKey, input.groupKey),
                  input.videoId ? eq(n.videoId, input.videoId) : isNull(n.videoId),
                  input.commentId ? eq(n.commentId, input.commentId) : isNull(n.commentId),
                  gt(n.createdAt, windowStart)
                )
              )
              .limit(1);
            if (seen) return null;
          }

          const open = input.groupKey
            ? await tx
                .select()
                .from(n)
                .where(
                  and(
                    eq(n.userId, input.userId),
                    eq(n.groupKey, input.groupKey),
                    isNull(n.readAt),
                    gt(n.createdAt, windowStart)
                  )
                )
                .orderBy(desc(n.createdAt))
                .limit(1)
                .for('update')
            : [];

          const [existing] = open;
          const saved = existing
            ? await this.fold(tx, existing, input, now)
            : await this.insert(tx, input, now);
          if (!saved) return null;

          await appendUserEvent(tx, {
            userId: input.userId,
            ...notificationCreated(
              toNotificationView(saved),
              await unreadCountOf(tx, input.userId)
            ),
          });
          return saved;
        }),
      databaseUnavailable.during('recordNotification')
    );
  }

  async list(
    userId: string,
    { filter, cursor, limit }: ListNotificationsOptions
  ): Promise<Result<Notification[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(n)
          .where(
            drizzleWhere(
              eq(n.userId, userId),
              filter === 'all' ? undefined : inArray(n.kind, [...kindsOfFilter(filter)]),
              keysetBefore(n.createdAt, n.id, cursor && { sort: cursor.createdAt, tie: cursor.id })
            )
          )
          .orderBy(desc(n.createdAt), desc(n.id))
          .limit(limit + 1),
      databaseUnavailable.during('listNotifications')
    );
  }

  async findByIds(ids: readonly string[]): Promise<Result<Notification[], DatabaseUnavailable>> {
    if (ids.length === 0) return ok([]);

    return fromPromise(
      () =>
        this.db
          .select()
          .from(n)
          .where(inArray(n.id, [...ids])),
      databaseUnavailable.during('findNotifications')
    );
  }

  async unreadCount(userId: string): Promise<Result<number, DatabaseUnavailable>> {
    return fromPromise(
      () => unreadCountOf(this.db, userId),
      databaseUnavailable.during('countUnreadNotifications')
    );
  }

  async markRead(
    userId: string,
    scope: NotificationReadScope
  ): Promise<Result<MarkedRead, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          await lockUserEvents(tx, userId);

          const flipped = await tx
            .update(n)
            .set({ readAt: new Date() })
            .where(
              drizzleWhere(
                eq(n.userId, userId),
                isNull(n.readAt),
                scope.scope === 'ids' ? inArray(n.id, scope.ids) : undefined
              )
            )
            .returning({ id: n.id });

          const read = flipped.map((row) => row.id);
          const unreadCount = await unreadCountOf(tx, userId);
          if (read.length > 0) {
            const announced = scope.scope === 'all' ? scope : { ...scope, ids: read };
            await appendUserEvent(tx, { userId, ...notificationRead(announced, unreadCount) });
          }
          return { read, unreadCount };
        }),
      databaseUnavailable.during('markNotificationsRead')
    );
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
    const rows = await fromPromise(
      () => this.db.delete(n).where(lt(n.createdAt, cutoff)).returning({ id: n.id }),
      databaseUnavailable.during('pruneNotifications')
    );
    return map(rows, (pruned) => pruned.length);
  }

  private async insert(
    tx: PostgresDatabase,
    input: NewNotificationInput,
    now: Date
  ): Promise<Notification> {
    const [row] = await tx
      .insert(n)
      .values({
        id: uuidv7(),
        userId: input.userId,
        kind: input.kind,
        actorChannelId: input.actorChannelId,
        videoId: input.videoId,
        commentId: input.commentId,
        groupKey: input.groupKey,
        payload: { ...input.payload, count: 1 },
        createdAt: now,
      })
      .returning();
    if (!row) throw new Error('notifications insert returned no row');
    return row;
  }

  private async fold(
    tx: PostgresDatabase,
    existing: Notification,
    input: NewNotificationInput,
    now: Date
  ): Promise<Notification | null> {
    const folded = foldNotification(existing, input, now);
    if (!folded) return null;

    const [row] = await tx
      .update(n)
      .set({
        actorChannelId: folded.actorChannelId,
        videoId: folded.videoId,
        commentId: folded.commentId,
        payload: folded.payload,
        createdAt: folded.createdAt,
      })
      .where(eq(n.id, existing.id))
      .returning();
    return row ?? null;
  }
}
