import type { UserEvent } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';

export interface UserEventRecord {
  id: number;
  userId: string;
  type: string;
  payload: unknown;
  createdAt: Date;
}

export type NewUserEventInput = { userId: string } & UserEvent;

/**
 * The log `GET /v1/me/events` replays. Every append is published on the user's channel through the
 * outbox in the same transaction, so a change that rolls back is never announced.
 */
export abstract class UserEventRepository {
  abstract append(event: NewUserEventInput): Promise<Result<UserEventRecord, DatabaseUnavailable>>;
  /** Starts at `fromId` itself, so the caller can tell whether that event is still in the log. */
  abstract listFrom(
    userId: string,
    fromId: number,
    limit: number
  ): Promise<Result<UserEventRecord[], DatabaseUnavailable>>;
  /** The newest id this user has in the log, `0` for none. */
  abstract latestId(userId: string): Promise<Result<number, DatabaseUnavailable>>;
  abstract prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>>;
}
