import type { DatabaseUnavailable } from '@kit/errors';
import { isErr, map, ok, type Result } from '@kit/result';
import type {
  CreateExportOutcome,
  DataExportListQuery,
  DataExportRepositoryPort,
  FinishedExport,
  OutboxRepository,
  UserEventRepository,
} from '@vp/core/repositories';
import {
  DATA_EXPORT_EDGES as EDGES,
  type DataExport,
  type DataExportStatus,
  type DataExportUsage,
  exportFailed,
  exportReady,
  type NewChannelAuditEntry,
  type NewDataExport,
} from '@vp/domain';
import { exportOutbox } from '@vp/job-contracts';
import type { Clock } from './clock';
import type { InMemoryChannelAuditRepository } from './in-memory-channel-audit-repository';
import { byKeysetDesc, isKeysetBefore } from './keyset';

export interface InMemoryDataExportRepositoryOptions {
  audit: Pick<InMemoryChannelAuditRepository, 'append'>;
  outbox: Pick<OutboxRepository, 'enqueue'>;
  userEvents: Pick<UserEventRepository, 'append'>;
  now: Clock;
}

const keysetOf = ({ createdAt, id }: DataExport) => ({ sort: createdAt, tie: id });

const isIn = (status: DataExportStatus, from: readonly DataExportStatus[]) => from.includes(status);

/** Each write moves a row only from the statuses its edge leaves, as the postgres `WHERE` does. */
export class InMemoryDataExportRepository implements DataExportRepositoryPort {
  private readonly rows = new Map<string, DataExport>();

  constructor(private readonly deps: InMemoryDataExportRepositoryOptions) {}

  private copy(row: DataExport | undefined): DataExport | null {
    return row ? { ...row, params: { ...row.params } } : null;
  }

  private move(
    id: string,
    from: readonly DataExportStatus[],
    change: Partial<DataExport>
  ): DataExport | null {
    const row = this.rows.get(id);
    if (!row || !isIn(row.status, from)) return null;
    Object.assign(row, change);
    return this.copy(row);
  }

  async usage(
    channelId: string,
    since: Date
  ): Promise<Result<DataExportUsage, DatabaseUnavailable>> {
    const own = [...this.rows.values()].filter((row) => row.channelId === channelId);
    return ok({
      running: own.some((row) => isIn(row.status, EDGES.fail.from)),
      today: own.filter((row) => row.createdAt.getTime() >= since.getTime()).length,
    });
  }

  async create(
    dataExport: NewDataExport,
    audit: NewChannelAuditEntry
  ): Promise<Result<CreateExportOutcome, DatabaseUnavailable>> {
    const running = [...this.rows.values()].some(
      (row) => row.channelId === dataExport.channelId && isIn(row.status, EDGES.fail.from)
    );
    if (running) return ok({ type: 'already-running' });

    const created: DataExport = {
      ...dataExport,
      status: 'queued',
      objectKey: null,
      rowCount: null,
      failure: null,
      expiresAt: null,
      createdAt: new Date(this.deps.now()),
    };
    this.rows.set(created.id, created);
    const audited = await this.deps.audit.append(audit);
    if (isErr(audited)) return audited;
    return map(await this.deps.outbox.enqueue(exportOutbox({ exportId: created.id })), () => ({
      type: 'created' as const,
      dataExport: { ...created },
    }));
  }

  async findById(id: string): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    return ok(this.copy(this.rows.get(id)));
  }

  async list(
    channelId: string,
    { kinds, cursor, limit }: DataExportListQuery
  ): Promise<Result<DataExport[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    return ok(
      [...this.rows.values()]
        .filter(
          (row) =>
            row.channelId === channelId &&
            kinds.includes(row.kind) &&
            isKeysetBefore(keysetOf(row), after)
        )
        .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)))
        .slice(0, limit + 1)
        .map((row) => ({ ...row }))
    );
  }

  async remove(
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    const removed = this.copy(this.rows.get(id));
    if (!removed) return ok(null);
    this.rows.delete(id);
    return map(await this.deps.audit.append(audit), () => removed);
  }

  async start(id: string): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    return ok(this.move(id, EDGES.start.from, { status: EDGES.start.to }));
  }

  async finish(
    id: string,
    { objectKey, rowCount, expiresAt }: FinishedExport
  ): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    const ready = this.move(id, EDGES.finish.from, {
      status: EDGES.finish.to,
      objectKey,
      rowCount,
      expiresAt,
    });
    if (!ready?.requestedBy) return ok(ready);
    const { channelId, kind, format, requestedBy } = ready;
    const announced = await this.deps.userEvents.append({
      userId: requestedBy,
      ...exportReady({
        exportId: id,
        channelId,
        kind,
        format,
        rowCount,
        expiresAt: expiresAt.toISOString(),
      }),
    });
    return map(announced, () => ready);
  }

  async fail(id: string, reason: string): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    const failed = this.move(id, EDGES.fail.from, { status: EDGES.fail.to, failure: reason });
    if (!failed?.requestedBy) return ok(failed);
    const { channelId, kind, requestedBy } = failed;
    const announced = await this.deps.userEvents.append({
      userId: requestedBy,
      ...exportFailed({ exportId: id, channelId, kind, reason }),
    });
    return map(announced, () => failed);
  }

  async listStale(cutoff: Date, limit: number): Promise<Result<DataExport[], DatabaseUnavailable>> {
    return ok(
      [...this.rows.values()]
        .filter(
          (row) => isIn(row.status, EDGES.fail.from) && row.createdAt.getTime() < cutoff.getTime()
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
        .slice(0, limit)
        .map((row) => ({ ...row }))
    );
  }

  async listExpired(now: Date, limit: number): Promise<Result<DataExport[], DatabaseUnavailable>> {
    return ok(
      [...this.rows.values()]
        .filter(
          (row) =>
            isIn(row.status, EDGES.expire.from) &&
            row.expiresAt !== null &&
            row.expiresAt.getTime() <= now.getTime()
        )
        .sort(
          (a, b) =>
            (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0) ||
            a.id.localeCompare(b.id)
        )
        .slice(0, limit)
        .map((row) => ({ ...row }))
    );
  }

  async expire(ids: readonly string[]): Promise<Result<number, DatabaseUnavailable>> {
    const expired = ids.filter((id) =>
      this.move(id, EDGES.expire.from, { status: EDGES.expire.to, objectKey: null })
    );
    return ok(expired.length);
  }

  clear(): void {
    this.rows.clear();
  }
}
