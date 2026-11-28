import { fromPromise, type Result } from '@kit/result';
import type { ReportFiling, WatchPartyReportRepositoryPort } from '@vp/core/repositories';
import * as schema from '@vp/db';
import type { WatchPartyReport } from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresDatabase } from './types';
import { lockRoom } from './watch-party-writes';

const { watchPartyReports: reports, watchPartyRooms: rooms } = schema;

export class PostgresWatchPartyReportRepository implements WatchPartyReportRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async file(
    report: WatchPartyReport,
    hideAt: number,
    now: Date
  ): Promise<Result<ReportFiling, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx): Promise<ReportFiling> => {
          await lockRoom(tx, report.roomId);
          const inserted = await tx
            .insert(reports)
            .values(report)
            .onConflictDoNothing()
            .returning({ id: reports.id });
          if (inserted.length === 0) return { type: 'duplicate' };
          if (report.targetKey !== null) return { type: 'filed', hidden: false };

          const [open] = await tx
            .select({ reporters: sql<number>`count(distinct ${reports.reporterId})::int` })
            .from(reports)
            .where(
              and(
                eq(reports.roomId, report.roomId),
                isNull(reports.targetKey),
                isNull(reports.resolvedAt)
              )
            );
          if ((open?.reporters ?? 0) < hideAt) return { type: 'filed', hidden: false };
          const hidden = await tx
            .update(rooms)
            .set({ hiddenAt: now })
            .where(and(eq(rooms.id, report.roomId), isNull(rooms.hiddenAt)))
            .returning({ id: rooms.id });
          return { type: 'filed', hidden: hidden.length > 0 };
        }),
      databaseUnavailable.during('fileWatchPartyReport')
    );
  }

  async restore(roomId: string, at: Date): Promise<Result<boolean, DatabaseUnavailable>> {
    return await fromPromise(
      () =>
        this.db.transaction(async (tx) => {
          const found = await tx
            .update(rooms)
            .set({ hiddenAt: null })
            .where(eq(rooms.id, roomId))
            .returning({ id: rooms.id });
          await tx
            .update(reports)
            .set({ resolvedAt: at })
            .where(and(eq(reports.roomId, roomId), isNull(reports.resolvedAt)));
          return found.length > 0;
        }),
      databaseUnavailable.during('restoreWatchPartyRoom')
    );
  }
}
