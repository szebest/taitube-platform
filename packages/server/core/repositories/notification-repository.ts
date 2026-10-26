import type {
  NewNotificationInput,
  Notification,
  NotificationFilter,
  NotificationReadScope,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface ListNotificationsOptions {
  filter: NotificationFilter;
  cursor?: { createdAt: Date; id: string };
  limit: number;
}

export interface MarkedRead {
  /** The ids that went from unread to read; announced with the count that is left. */
  read: string[];
  unreadCount: number;
}

/**
 * Every write that changes what the bell shows (`record`, `markRead`) also appends its event to the
 * owner's user stream, in the same transaction, so a rolled-back change announces nothing.
 */
export interface NotificationRepositoryPort {
  /**
   * Inserts, or folds into the user's unread row with the same `groupKey` from the last hour: the
   * row takes the newest actor and subject, counts one more and moves to the top. The same subject
   * again changes nothing and answers `null`, so a retried job never counts twice.
   */
  record(input: NewNotificationInput): Promise<Result<Notification | null, DatabaseUnavailable>>;
  /** Returns up to `limit + 1` rows so the caller can tell whether another page follows. */
  list(
    userId: string,
    options: ListNotificationsOptions
  ): Promise<Result<Notification[], DatabaseUnavailable>>;
  findByIds(ids: readonly string[]): Promise<Result<Notification[], DatabaseUnavailable>>;
  unreadCount(userId: string): Promise<Result<number, DatabaseUnavailable>>;
  markRead(
    userId: string,
    scope: NotificationReadScope
  ): Promise<Result<MarkedRead, DatabaseUnavailable>>;
  prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>>;
}
