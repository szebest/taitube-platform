import type {
  CreateExportOutcome,
  DataExportListQuery,
  DataExportRepositoryPort,
  FinishedExport,
} from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  DATA_EXPORT_EDGES as EDGES,
  type DataExport,
  type DataExportUsage,
  exportFailed,
  exportReady,
  type NewChannelAuditEntry,
  type NewDataExport,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { exportOutbox } from '@vp/job-contracts';
import { fromPromise, map, ok, type Result } from '@vp/result';
import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { keysetBefore, msTimestamp } from '../scopes/index';
import { appendChannelAudit } from './channel-audit-writes';
import { enqueueNotificationJobs } from './notification-jobs';
import { appendUserEvent } from './postgres-user-event-repository';
import type { PostgresDatabase } from './types';

const { dataExports: x } = schema;

const UNSETTLED = EDGES.fail.from;

/** Inlined, not bound: `ON CONFLICT` infers the partial index only from a predicate it can read. */
const unsettled = sql.raw(
  `${x.status.name} IN (${UNSETTLED.map((status) => `'${status}'`).join(', ')})`
);

export class PostgresDataExportRepository implements DataExportRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async usage(
    channelId: string,
    since: Date
  ): Promise<Result<DataExportUsage, DatabaseUnavailable>> {
    const counted = await fromPromise(
      () =>
        this.db
          .select({
            running:
              sql<number>`count(*) filter (where ${inArray(x.status, [...UNSETTLED])})`.mapWith(
                Number
              ),
            today: sql<number>`count(*) filter (where ${gte(x.createdAt, since)})`.mapWith(Number),
          })
          .from(x)
          .where(eq(x.channelId, channelId)),
      databaseUnavailable.during('dataExportUsage')
    );
    return map(counted, ([row]) => ({ running: (row?.running ?? 0) > 0, today: row?.today ?? 0 }));
  }

  async create(
    dataExport: NewDataExport,
    audit: NewChannelAuditEntry
  ): Promise<Result<CreateExportOutcome, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<CreateExportOutcome> => {
          const [created] = await tx
            .insert(x)
            .values(dataExport)
            .onConflictDoNothing({
              target: x.channelId,
              where: unsettled,
            })
            .returning();
          if (!created) return { type: 'already-running' };

          await appendChannelAudit(tx, audit);
          await enqueueNotificationJobs(tx, [exportOutbox({ exportId: created.id })]);
          return { type: 'created', dataExport: created };
        }),
      databaseUnavailable.during('createDataExport')
    );
  }

  async findById(id: string): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () => this.db.select().from(x).where(eq(x.id, id)).limit(1),
      databaseUnavailable.during('findDataExport')
    );
    return map(rows, ([found]) => found ?? null);
  }

  async list(
    channelId: string,
    { kinds, cursor, limit }: DataExportListQuery
  ): Promise<Result<DataExport[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(x)
          .where(
            and(
              eq(x.channelId, channelId),
              inArray(x.kind, [...kinds]),
              keysetBefore(
                msTimestamp(x.createdAt),
                x.id,
                cursor && { sort: cursor.createdAt, tie: cursor.id }
              )
            )
          )
          .orderBy(desc(msTimestamp(x.createdAt)), desc(x.id))
          .limit(limit + 1),
      databaseUnavailable.during('listDataExports')
    );
  }

  async remove(
    id: string,
    audit: NewChannelAuditEntry
  ): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [removed] = await tx.delete(x).where(eq(x.id, id)).returning();
          if (!removed) return null;

          await appendChannelAudit(tx, audit);
          return removed;
        }),
      databaseUnavailable.during('removeDataExport')
    );
  }

  async start(id: string): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    const rows = await fromPromise(
      () =>
        this.db
          .update(x)
          .set({ status: EDGES.start.to })
          .where(and(eq(x.id, id), inArray(x.status, [...EDGES.start.from])))
          .returning(),
      databaseUnavailable.during('startDataExport')
    );
    return map(rows, ([started]) => started ?? null);
  }

  async finish(
    id: string,
    { objectKey, rowCount, expiresAt }: FinishedExport
  ): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [ready] = await tx
            .update(x)
            .set({ status: EDGES.finish.to, objectKey, rowCount, expiresAt })
            .where(and(eq(x.id, id), inArray(x.status, [...EDGES.finish.from])))
            .returning();
          if (!ready) return null;

          if (ready.requestedBy) {
            await appendUserEvent(tx, {
              userId: ready.requestedBy,
              ...exportReady({
                exportId: ready.id,
                channelId: ready.channelId,
                kind: ready.kind,
                format: ready.format,
                rowCount,
                expiresAt: expiresAt.toISOString(),
              }),
            });
          }
          return ready;
        }),
      databaseUnavailable.during('finishDataExport')
    );
  }

  async fail(id: string, reason: string): Promise<Result<DataExport | null, DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const [failed] = await tx
            .update(x)
            .set({ status: EDGES.fail.to, failure: reason })
            .where(and(eq(x.id, id), inArray(x.status, [...EDGES.fail.from])))
            .returning();
          if (!failed) return null;

          if (failed.requestedBy) {
            await appendUserEvent(tx, {
              userId: failed.requestedBy,
              ...exportFailed({
                exportId: failed.id,
                channelId: failed.channelId,
                kind: failed.kind,
                reason,
              }),
            });
          }
          return failed;
        }),
      databaseUnavailable.during('failDataExport')
    );
  }

  async listStale(cutoff: Date, limit: number): Promise<Result<DataExport[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(x)
          .where(and(inArray(x.status, [...UNSETTLED]), lt(x.createdAt, cutoff)))
          .orderBy(asc(x.createdAt), asc(x.id))
          .limit(limit),
      databaseUnavailable.during('listStaleDataExports')
    );
  }

  async listExpired(now: Date, limit: number): Promise<Result<DataExport[], DatabaseUnavailable>> {
    return fromPromise(
      () =>
        this.db
          .select()
          .from(x)
          .where(and(inArray(x.status, [...EDGES.expire.from]), lte(x.expiresAt, now)))
          .orderBy(asc(x.expiresAt), asc(x.id))
          .limit(limit),
      databaseUnavailable.during('listExpiredDataExports')
    );
  }

  async expire(ids: readonly string[]): Promise<Result<number, DatabaseUnavailable>> {
    if (ids.length === 0) return ok(0);
    const rows = await fromPromise(
      () =>
        this.db
          .update(x)
          .set({ status: EDGES.expire.to, objectKey: null })
          .where(and(inArray(x.id, [...ids]), inArray(x.status, [...EDGES.expire.from])))
          .returning({ id: x.id }),
      databaseUnavailable.during('expireDataExports')
    );
    return map(rows, (expired) => expired.length);
  }
}
