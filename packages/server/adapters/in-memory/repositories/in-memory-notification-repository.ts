import type {
  ListNotificationsOptions,
  MarkedRead,
  NotificationRepositoryPort,
  UserEventRepository,
} from '@vp/core/repositories';
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
import type { DatabaseUnavailable } from '@vp/errors';
import { isErr, ok, type Result } from '@vp/result';
import { uuidv7 } from 'uuidv7';
import { byKeysetDesc, isKeysetBefore } from './keyset';

export class InMemoryNotificationRepository implements NotificationRepositoryPort {
  private notifications = new Map<string, Notification>();

  constructor(private readonly userEvents: UserEventRepository) {}

  async record(
    input: NewNotificationInput
  ): Promise<Result<Notification | null, DatabaseUnavailable>> {
    const now = new Date();
    if (this.seenInWindow(input, now)) return ok(null);

    const open = this.openGroup(input, now);
    const saved = open ? foldNotification(open, input, now) : this.insert(input, now);
    if (!saved) return ok(null);

    this.notifications.set(saved.id, saved);
    const announced = await this.userEvents.append({
      userId: input.userId,
      ...notificationCreated(toNotificationView(saved), this.unreadOf(input.userId)),
    });
    return isErr(announced) ? announced : ok({ ...saved });
  }

  async list(
    userId: string,
    { filter, cursor, limit }: ListNotificationsOptions
  ): Promise<Result<Notification[], DatabaseUnavailable>> {
    const kinds = kindsOfFilter(filter);
    const keyed = (notification: Notification) => ({
      notification,
      sort: notification.createdAt,
      tie: notification.id,
    });
    const page = this.of(userId)
      .filter((notification) => kinds.includes(notification.kind))
      .map(keyed)
      .sort(byKeysetDesc)
      .filter((row) => isKeysetBefore(row, cursor && { sort: cursor.createdAt, tie: cursor.id }))
      .slice(0, limit + 1);
    return ok(page.map(({ notification }) => ({ ...notification })));
  }

  async findByIds(ids: readonly string[]): Promise<Result<Notification[], DatabaseUnavailable>> {
    const found = ids.flatMap((id) => this.notifications.get(id) ?? []);
    return ok(found.map((notification) => ({ ...notification })));
  }

  async unreadCount(userId: string): Promise<Result<number, DatabaseUnavailable>> {
    return ok(this.unreadOf(userId));
  }

  async markRead(
    userId: string,
    scope: NotificationReadScope
  ): Promise<Result<MarkedRead, DatabaseUnavailable>> {
    const now = new Date();
    const read: string[] = [];
    for (const notification of this.of(userId)) {
      if (notification.readAt || (scope.scope === 'ids' && !scope.ids.includes(notification.id))) {
        continue;
      }
      notification.readAt = now;
      read.push(notification.id);
    }

    const unreadCount = this.unreadOf(userId);
    if (read.length === 0) return ok({ read, unreadCount });

    const announced = await this.userEvents.append({
      userId,
      ...notificationRead(scope.scope === 'all' ? scope : { ...scope, ids: read }, unreadCount),
    });
    return isErr(announced) ? announced : ok({ read, unreadCount });
  }

  async prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>> {
    const cutoff = Date.now() - retentionDays * MS_PER_DAY;
    let pruned = 0;
    for (const [id, notification] of this.notifications) {
      if (notification.createdAt.getTime() >= cutoff) continue;
      this.notifications.delete(id);
      pruned += 1;
    }
    return ok(pruned);
  }

  /** Moves every notification into the past, which specs use in place of waiting. */
  age(ms: number): void {
    for (const notification of this.notifications.values()) {
      notification.createdAt = new Date(notification.createdAt.getTime() - ms);
    }
  }

  clear(): void {
    this.notifications.clear();
  }

  private of(userId: string): Notification[] {
    return [...this.notifications.values()].filter(
      (notification) => notification.userId === userId
    );
  }

  private unreadOf(userId: string): number {
    return this.of(userId).filter((notification) => !notification.readAt).length;
  }

  private inWindow(input: NewNotificationInput, now: Date): Notification[] {
    if (!input.groupKey) return [];

    return this.of(input.userId).filter(
      (notification) =>
        notification.groupKey === input.groupKey &&
        notification.createdAt.getTime() > now.getTime() - NOTIFICATION_GROUP_WINDOW_MS
    );
  }

  private seenInWindow(input: NewNotificationInput, now: Date): boolean {
    return this.inWindow(input, now).some(
      (notification) =>
        notification.videoId === input.videoId && notification.commentId === input.commentId
    );
  }

  private openGroup(input: NewNotificationInput, now: Date): Notification | undefined {
    return this.inWindow(input, now)
      .filter((notification) => !notification.readAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private insert(input: NewNotificationInput, now: Date): Notification {
    return {
      id: uuidv7(),
      userId: input.userId,
      kind: input.kind,
      actorChannelId: input.actorChannelId,
      videoId: input.videoId,
      commentId: input.commentId,
      groupKey: input.groupKey,
      payload: { ...input.payload, count: 1 },
      readAt: null,
      createdAt: now,
    };
  }
}
