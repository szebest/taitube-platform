import type { JobQueue } from '@vp/core/ports';
import type {
  DlqEntryRecord,
  DlqRepository,
  DlqStatus,
  EventRepository,
} from '@vp/core/repositories';
import {
  type AuthorizationFailure,
  type DlqEntryNotFound,
  type ReplayQueueUnknown,
  decideAdminAccess,
  dlqEntryNotFound,
  replayQueueUnknown,
} from '@vp/domain-rules';
import type { DatabaseUnavailable, QueueUnavailable } from '@vp/errors';
import { defaultJobOptions, generateReplayJobId, stagePolicies } from '@vp/job-contracts';
import type { InvalidCursor, Paginator } from '@vp/pagination';
import type { UserContext } from '@vp/permissions';
import { type Result, err, isErr, map, ok } from '@vp/result';
import { createdAtCursorPayload, decodeCreatedAtCursor } from './cursor';

export interface DlqServiceDeps {
  dlq: DlqRepository;
  events: EventRepository;
  queues: Map<string, JobQueue>;
  paginator: Paginator;
}

export interface ReplayDlqResult {
  status: 'REPLAYED';
  dlqEntryId: string;
  replayJobId: string;
}

export type ListDlqFailure = AuthorizationFailure | InvalidCursor | DatabaseUnavailable;
export type ReplayDlqFailure =
  | AuthorizationFailure
  | DlqEntryNotFound
  | ReplayQueueUnknown
  | DatabaseUnavailable
  | QueueUnavailable;
export type DiscardDlqFailure = AuthorizationFailure | DlqEntryNotFound | DatabaseUnavailable;

/**
 * Dead-letter queue inspection, replay and discarding. Admin access is a rule, absence is a rule,
 * and both are returned: nothing here throws and nothing here renders.
 */
export class DlqService {
  constructor(private readonly deps: DlqServiceDeps) {}

  async list(
    caller: UserContext | null,
    options: { cursor?: string; limit?: number; status?: DlqStatus }
  ): Promise<Result<{ items: DlqEntryRecord[]; nextCursor: string | null }, ListDlqFailure>> {
    const admin = decideAdminAccess(caller);
    if (isErr(admin)) return admin;

    const cursor = decodeCreatedAtCursor(options.cursor, this.deps.paginator);
    if (isErr(cursor)) return cursor;

    const limit = this.deps.paginator.limit(options.limit);
    const rows = await this.deps.dlq.list({
      cursor: cursor.value,
      limit,
      status: options.status || undefined,
    });

    return map(rows, (found) =>
      this.deps.paginator.paginate(found, limit, {
        cursorOf: createdAtCursorPayload,
        toItem: (row) => row,
      })
    );
  }

  /** Replays a dead-letter job into its origin queue under a fresh id and records an audit event. */
  async replay(
    caller: UserContext | null,
    id: string
  ): Promise<Result<ReplayDlqResult, ReplayDlqFailure>> {
    const entry = await this.entryFor(caller, id);
    if (isErr(entry)) return entry;

    const targetQueue = this.deps.queues.get(entry.value.queue);
    if (!targetQueue) return err(replayQueueUnknown(entry.value.queue));

    const replayJobId = generateReplayJobId(entry.value.jobId);
    const replayOpts = {
      jobId: replayJobId,
      ...(entry.value.queue in stagePolicies
        ? stagePolicies[entry.value.queue as keyof typeof stagePolicies]
        : {}),
      ...defaultJobOptions,
    };

    const updated = await this.deps.dlq.updateStatus(
      id,
      'REPLAYED',
      { replayedAt: new Date() },
      {
        kind: 'dlq_replay',
        payload: {
          type: 'queue',
          queueName: entry.value.queue,
          job: { name: entry.value.queue, data: entry.value.payload, opts: replayOpts },
        },
      }
    );
    if (isErr(updated)) return updated;

    const enqueued = await targetQueue.add(entry.value.queue, entry.value.payload, replayOpts);
    if (isErr(enqueued)) return enqueued;

    const recorded = await this.record(entry.value, 'dlq.replayed', {
      dlqEntryId: id,
      originQueue: entry.value.queue,
      originalJobId: entry.value.jobId,
      replayJobId,
    });
    if (isErr(recorded)) return recorded;

    return ok({ status: 'REPLAYED', dlqEntryId: id, replayJobId });
  }

  async discard(caller: UserContext | null, id: string): Promise<Result<void, DiscardDlqFailure>> {
    const entry = await this.entryFor(caller, id);
    if (isErr(entry)) return entry;

    const updated = await this.deps.dlq.updateStatus(id, 'DISCARDED');
    if (isErr(updated)) return updated;

    return this.record(entry.value, 'dlq.discarded', {
      dlqEntryId: id,
      originQueue: entry.value.queue,
      originalJobId: entry.value.jobId,
    });
  }

  private async entryFor(
    caller: UserContext | null,
    id: string
  ): Promise<
    Result<DlqEntryRecord, AuthorizationFailure | DlqEntryNotFound | DatabaseUnavailable>
  > {
    const admin = decideAdminAccess(caller);
    if (isErr(admin)) return admin;

    const found = await this.deps.dlq.findById(id);
    if (isErr(found)) return found;

    return found.value ? ok(found.value) : err(dlqEntryNotFound(id));
  }

  /** An entry parked without a video has nothing to append an event to. */
  private async record(
    entry: DlqEntryRecord,
    type: string,
    payload: Record<string, unknown>
  ): Promise<Result<void, DatabaseUnavailable>> {
    if (!entry.videoId) return ok();
    return map(
      await this.deps.events.create({ videoId: entry.videoId, type, payload }),
      () => undefined
    );
  }
}
