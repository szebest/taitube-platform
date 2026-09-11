import type { FlowJobNode } from '../ports/flow-producer.js';
import type { QueueJobOptions } from '../ports/job-queue.js';

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
  abstract enqueue(item: NewOutboxInput): Promise<OutboxRecord>;
  abstract claimBatch(limit?: number): Promise<OutboxRecord[]>;
  abstract markPublished(id: string): Promise<boolean>;
  abstract recordAttempt(id: string): Promise<boolean>;
  abstract prune(retentionDays?: number): Promise<number>;
  abstract findById(id: string): Promise<OutboxRecord | null>;
}
