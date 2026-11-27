import { type Result, isErr, ok } from '@kit/result';
import type {
  ChannelLayoutSchedule,
  ChannelLayoutScheduleRepositoryPort,
  NewChannelLayoutSchedule,
} from '@vp/core/repositories';
import { type NewChannelAuditEntry, isSchedulePending, scheduleAppliedAudit } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import { type Clock, realClock } from './clock';
import {
  type ChannelLayoutPublishDeps,
  publishChannelLayout,
} from './in-memory-channel-layout-publish';

export class InMemoryChannelLayoutScheduleRepository implements ChannelLayoutScheduleRepositoryPort {
  private readonly rows = new Map<string, ChannelLayoutSchedule>();

  constructor(
    private readonly deps: ChannelLayoutPublishDeps,
    private readonly now: Clock = realClock
  ) {}

  async create(
    input: NewChannelLayoutSchedule,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule, DatabaseUnavailable>> {
    const written = await this.deps.audit.append(audit);
    if (isErr(written)) return written;
    const row: ChannelLayoutSchedule = {
      ...input,
      status: 'pending',
      createdAt: new Date(this.now()),
    };
    this.rows.set(row.id, row);
    return ok({ ...row });
  }

  async listPending(
    channelId: string
  ): Promise<Result<ChannelLayoutSchedule[], DatabaseUnavailable>> {
    return ok(
      [...this.rows.values()]
        .filter((row) => row.channelId === channelId && isSchedulePending(row.status))
        .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime())
        .map((row) => ({ ...row }))
    );
  }

  async cancel(
    channelId: string,
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule | null, DatabaseUnavailable>> {
    const row = this.rows.get(id);
    if (!row || row.channelId !== channelId || !isSchedulePending(row.status)) return ok(null);
    row.status = 'cancelled';
    const written = await this.deps.audit.append(audit);
    if (isErr(written)) return written;
    return ok({ ...row });
  }

  async promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>> {
    const due = [...this.rows.values()]
      .filter((row) => isSchedulePending(row.status) && row.publishAt <= now)
      .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime())
      .slice(0, limit);
    const applied: string[] = [];
    for (const row of due) {
      row.status = 'applied';
      const published = await publishChannelLayout(
        this.deps,
        {
          channelId: row.channelId,
          document: row.document,
          authorUserId: row.createdBy,
          note: null,
          restoredFromVersion: null,
          audit: scheduleAppliedAudit(row),
        },
        new Date(this.now())
      );
      if (isErr(published)) return published;
      applied.push(row.id);
    }
    return ok(applied);
  }

  clear(): void {
    this.rows.clear();
  }
}
