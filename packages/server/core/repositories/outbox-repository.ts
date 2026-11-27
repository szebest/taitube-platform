import type { DatabaseUnavailable } from '@kit/errors';
import type { FlowJobNode } from '@kit/ports';
import type { QueueJobOptions } from '@kit/ports';
import type { Result } from '@kit/result';
import type { OutboxStatus } from '@vp/domain';

interface OutboxQueueJobPayload {
  name: string;
  data: unknown;
  opts?: QueueJobOptions;
}

export type OutboxPayload =
  | { type: 'queue'; queueName: string; job: OutboxQueueJobPayload }
  | { type: 'flow'; flow: FlowJobNode }
  | { type: 'pubsub'; channel: string; message: string };

export interface OutboxRecord {
  id: string;
  kind: string;
  payload: OutboxPayload;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
  status: OutboxStatus;
}

export interface NewOutboxInput {
  id?: string;
  kind: string;
  payload: OutboxPayload;
}

/** A row moves through `OUTBOX_ROW`: published once, or `DEAD` after `OUTBOX_MAX_ATTEMPTS` failures. */
export abstract class OutboxRepository {
  abstract enqueue(item: NewOutboxInput): Promise<Result<OutboxRecord, DatabaseUnavailable>>;
  /**
   * The oldest pending rows nobody holds, each leased to this caller for `OUTBOX_CLAIM_LEASE_MS`,
   * so a second relay draining at the same time skips them.
   */
  abstract claimBatch(limit: number): Promise<Result<OutboxRecord[], DatabaseUnavailable>>;
  /** `false` when the row is gone or no longer pending. */
  abstract markPublished(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  /** Counts a failed publish and answers where it left the row; `null` when the row is gone or no longer pending. */
  abstract recordAttempt(id: string): Promise<Result<OutboxStatus | null, DatabaseUnavailable>>;
  abstract prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>>;
  abstract findById(id: string): Promise<Result<OutboxRecord | null, DatabaseUnavailable>>;
}
