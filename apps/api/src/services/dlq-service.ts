import { CaslAuthorizationAdapter } from '@vp/adapters';
import { type Paginator, defaultPaginator } from '@vp/core/pagination';
import type { AuthorizationPort, JobQueue } from '@vp/core/ports';
import type {
  DlqEntryRecord,
  DlqRepository,
  DlqStatus,
  EventRepository,
} from '@vp/core/repositories';
import { ErrorCodes, PermanentError } from '@vp/errors';
import { defaultJobOptions, generateReplayJobId, stagePolicies } from '@vp/job-contracts';
import type { AuthUser } from '../plugins/auth';
import { assertAdminAccess } from './admin-access';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface DlqServiceDeps {
  dlq: DlqRepository;
  events: EventRepository;
  queues: Map<string, JobQueue>;
  authorization?: AuthorizationPort;
  paginator?: Paginator;
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
  private readonly auth: AuthorizationPort;
  private readonly paginator: Paginator;

  constructor(deps: DlqServiceDeps) {
    this.dlq = deps.dlq;
    this.events = deps.events;
    this.queues = deps.queues;
    this.auth = deps.authorization ?? new CaslAuthorizationAdapter();
    this.paginator = deps.paginator ?? defaultPaginator;
  }

  /**
   * Lists DLQ entries with cursor pagination and status filters.
   */
  async list(
    caller: AuthUser | null,
    options: { cursor?: string; limit?: number; status?: DlqStatus }
  ): Promise<{ items: DlqEntryRecord[]; nextCursor: string | null }> {
    assertAdminAccess(this.auth, caller);
    const limit = this.paginator.limit(options.limit);
    const rows = await this.dlq.list({
      cursor: decodeCreatedAtCursor(options.cursor, this.paginator),
      limit,
      ...(options.status ? { status: options.status } : {}),
    });

    return this.paginator.paginate(rows, limit, {
      cursorOf: createdAtCursorPayload,
      toItem: (row) => row,
    });
  }

  /**
   * Replays a dead-letter job into its origin queue with a fresh replay suffix and registers an audit event.
   */
  async replay(caller: AuthUser | null, id: string): Promise<ReplayDlqResult> {
    assertAdminAccess(this.auth, caller);
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
  async discard(caller: AuthUser | null, id: string): Promise<void> {
    assertAdminAccess(this.auth, caller);
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
