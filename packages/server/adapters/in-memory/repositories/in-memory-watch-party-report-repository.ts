import { ok, type Result } from '@kit/result';
import type { ReportFiling, WatchPartyReportRepositoryPort } from '@vp/core/repositories';
import type { WatchPartyReport } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InMemoryWatchPartyStore } from './in-memory-watch-party-store';

export class InMemoryWatchPartyReportRepository implements WatchPartyReportRepositoryPort {
  constructor(private readonly store: InMemoryWatchPartyStore) {}

  async file(
    report: WatchPartyReport,
    hideAt: number,
    now: Date
  ): Promise<Result<ReportFiling, DatabaseUnavailable>> {
    const rows = [...this.store.reports.values()];
    const duplicate = rows.some(
      (row) =>
        row.report.roomId === report.roomId &&
        row.report.reporterId === report.reporterId &&
        row.report.targetKey === report.targetKey
    );
    if (duplicate) return ok({ type: 'duplicate' });
    this.store.reports.set(report.id, { report: { ...report }, resolvedAt: null });
    if (report.targetKey !== null) return ok({ type: 'filed', hidden: false });

    const reporters = new Set(
      [...this.store.reports.values()]
        .filter(
          ({ report: row, resolvedAt }) =>
            row.roomId === report.roomId && row.targetKey === null && resolvedAt === null
        )
        .map(({ report: row }) => row.reporterId)
    );
    const room = this.store.rooms.get(report.roomId);
    if (reporters.size < hideAt || !room || room.hiddenAt !== null) {
      return ok({ type: 'filed', hidden: false });
    }
    this.store.rooms.set(room.id, { ...room, hiddenAt: now });
    return ok({ type: 'filed', hidden: true });
  }

  async restore(roomId: string, at: Date): Promise<Result<boolean, DatabaseUnavailable>> {
    const room = this.store.rooms.get(roomId);
    if (room) this.store.rooms.set(roomId, { ...room, hiddenAt: null });
    for (const [id, row] of this.store.reports) {
      if (row.report.roomId === roomId && row.resolvedAt === null) {
        this.store.reports.set(id, { ...row, resolvedAt: at });
      }
    }
    return ok(room !== undefined);
  }
}
