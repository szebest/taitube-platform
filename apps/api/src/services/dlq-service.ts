import type { DlqRepository, EventRepository, JobQueue } from '@vp/core/ports';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { defaultJobOptions, generateReplayJobId, stagePolicies } from '@vp/job-contracts';

export interface DlqServiceDeps {
  dlq: DlqRepository;
  events: EventRepository;
  queues: Map<string, JobQueue>;
}

export interface ReplayDlqResult {
  status: 'REPLAYED';
  dlqEntryId: string;
  replayJobId: string;
}

/**
 * DlqService — Domain service managing Dead-Letter Queue inspection, replay, and discarding.
 */
export class DlqService {
  private readonly dlq: DlqRepository;
  private readonly events: EventRepository;
  private readonly queues: Map<string, JobQueue>;

  constructor(deps: DlqServiceDeps) {
    this.dlq = deps.dlq;
    this.events = deps.events;
    this.queues = deps.queues;
  }

  /**
   * Lists DLQ entries with cursor pagination and status filters.
   */
  async list(options: {
    cursor?: string;
    limit?: number;
    status?: 'PARKED' | 'REPLAYED' | 'DISCARDED';
  }) {
    return this.dlq.list(options);
  }

  /**
   * Replays a dead-letter job into its origin queue with a fresh replay suffix and registers an audit event.
   */
  async replay(id: string): Promise<ReplayDlqResult> {
    const entry = await this.dlq.findById(id);
    if (!entry) {
      throw new PermanentError(ErrorCodes.DLQ_ENTRY_NOT_FOUND, `DLQ entry "${id}" not found`);
    }

    const targetQueue = this.queues.get(entry.queue);
    if (!targetQueue) {
      throw new PermanentError(
        ErrorCodes.INTERNAL,
        `Target queue "${entry.queue}" is not available for replay`
      );
    }

    const replayJobId = generateReplayJobId(entry.jobId);
    const stageOpts =
      entry.queue in stagePolicies ? stagePolicies[entry.queue as keyof typeof stagePolicies] : {};
    const replayOpts = {
      jobId: replayJobId,
      ...stageOpts,
      ...defaultJobOptions,
    };

    await this.dlq.updateStatus(
      id,
      'REPLAYED',
      { replayedAt: new Date() },
      {
        kind: 'dlq_replay',
        payload: {
          type: 'queue',
          queueName: entry.queue,
          job: {
            name: entry.queue,
            data: entry.payload,
            opts: replayOpts,
          },
        },
      }
    );

    await targetQueue.add(entry.queue, entry.payload, replayOpts);

    if (entry.videoId) {
      await this.events.create({
        videoId: entry.videoId,
        type: 'dlq.replayed',
        payload: {
          dlqEntryId: id,
          originQueue: entry.queue,
          originalJobId: entry.jobId,
          replayJobId,
        },
      });
    }

    return {
      status: 'REPLAYED',
      dlqEntryId: id,
      replayJobId,
    };
  }

  /**
   * Marks a dead-letter queue entry as DISCARDED and records an audit event.
   */
  async discard(id: string): Promise<void> {
    const entry = await this.dlq.findById(id);
    if (!entry) {
      throw new PermanentError(ErrorCodes.DLQ_ENTRY_NOT_FOUND, `DLQ entry "${id}" not found`);
    }

    await this.dlq.updateStatus(id, 'DISCARDED');

    if (entry.videoId) {
      await this.events.create({
        videoId: entry.videoId,
        type: 'dlq.discarded',
        payload: {
          dlqEntryId: id,
          originQueue: entry.queue,
          originalJobId: entry.jobId,
        },
      });
    }
  }
}
