import { type Result, fromPromise, isErr, map } from '@kit/result';
import type {
  ChannelLayoutSchedule,
  ChannelLayoutScheduleRepositoryPort,
  NewChannelLayoutSchedule,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import { type NewChannelAuditEntry, scheduleAppliedAudit } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, asc, eq, lte } from 'drizzle-orm';
import { appendChannelAudit } from './channel-audit-writes';
import { publishLayoutRevision } from './channel-layout-writes';
import type { PostgresDatabase } from './types';

const { channelLayoutSchedules: schedules } = schema;

function toSchedule(row: typeof schedules.$inferSelect): ChannelLayoutSchedule {
  return {
    id: row.id,
    channelId: row.channelId,
    document: row.doc,
    publishAt: row.publishAt,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

export class PostgresChannelLayoutScheduleRepository implements ChannelLayoutScheduleRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async create(
    input: NewChannelLayoutSchedule,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule, DatabaseUnavailable>> {
    const created = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(schedules)
            .values({ ...input, doc: input.document })
            .returning();
          if (!row) throw new Error('channel layout schedule insert returned no row');
          await appendChannelAudit(tx, audit);
          return row;
        }),
      databaseUnavailable.during('createChannelLayoutSchedule')
    );
    return map(created, toSchedule);
  }

  async listPending(
    channelId: string
  ): Promise<Result<ChannelLayoutSchedule[], DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .select()
          .from(schedules)
          .where(and(eq(schedules.channelId, channelId), eq(schedules.status, 'pending')))
          .orderBy(asc(schedules.publishAt)),
      databaseUnavailable.during('listChannelLayoutSchedules')
    );
    return map(rows, (found) => found.map(toSchedule));
  }

  async cancel(
    channelId: string,
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<ChannelLayoutSchedule | null, DatabaseUnavailable>> {
    const cancelled = await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [row] = await tx
            .update(schedules)
            .set({ status: 'cancelled' })
            .where(
              and(
                eq(schedules.id, id),
                eq(schedules.channelId, channelId),
                eq(schedules.status, 'pending')
              )
            )
            .returning();
          if (row) await appendChannelAudit(tx, audit);
          return row ?? null;
        }),
      databaseUnavailable.during('cancelChannelLayoutSchedule')
    );
    return map(cancelled, (row) => (row ? toSchedule(row) : null));
  }

  async promoteDue(now: Date, limit: number): Promise<Result<string[], DatabaseUnavailable>> {
    const due = await fromPromise(
      () =>
        this.db
          .select({ id: schedules.id })
          .from(schedules)
          .where(and(eq(schedules.status, 'pending'), lte(schedules.publishAt, now)))
          .orderBy(asc(schedules.publishAt))
          .limit(limit),
      databaseUnavailable.during('listDueChannelLayoutSchedules')
    );
    if (isErr(due)) return due;
    const applied: string[] = [];
    for (const { id } of due.value) {
      const promoted = await fromPromise(
        () =>
          this.db.transaction(async (tx) => {
            const [row] = await tx
              .update(schedules)
              .set({ status: 'applied' })
              .where(and(eq(schedules.id, id), eq(schedules.status, 'pending')))
              .returning();
            if (!row) return false;
            await publishLayoutRevision(tx, {
              channelId: row.channelId,
              document: row.doc,
              authorUserId: row.createdBy,
              note: null,
              restoredFromVersion: null,
              audit: scheduleAppliedAudit(row),
            });
            return true;
          }),
        databaseUnavailable.during('promoteChannelLayoutSchedule')
      );
      if (isErr(promoted)) return promoted;
      if (promoted.value) applied.push(id);
    }
    return map(due, () => applied);
  }
}
