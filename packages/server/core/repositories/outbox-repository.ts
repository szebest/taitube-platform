import type { DatabaseUnavailable } from '@vp/errors';
import type { Result } from '@vp/result';
import type { FlowJobNode } from '../ports/flow-producer';
import type { QueueJobOptions } from '../ports/job-queue';

export interface OutboxQueueJobPayload {
  name: string;
  data: unknown;
  opts?: QueueJobOptions;
}

export type OutboxPayload =
  | { type: 'queue'; queueName: string; job: OutboxQueueJobPayload }
  | { type: 'flow'; flow: FlowJobNode };

export interface OutboxRecord {
  id: string;
  kind: string;
  payload: OutboxPayload;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
}

export interface NewOutboxInput {
  id?: string;
  kind: string;
  payload: OutboxPayload;
}

export abstract class OutboxRepository {
  abstract enqueue(item: NewOutboxInput): Promise<Result<OutboxRecord, DatabaseUnavailable>>;
  abstract claimBatch(limit: number): Promise<Result<OutboxRecord[], DatabaseUnavailable>>;
  abstract markPublished(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract recordAttempt(id: string): Promise<Result<boolean, DatabaseUnavailable>>;
  abstract prune(retentionDays: number): Promise<Result<number, DatabaseUnavailable>>;
  abstract findById(id: string): Promise<Result<OutboxRecord | null, DatabaseUnavailable>>;
}
