import type { Result } from '@kit/result';
import type { WatchPartyReport } from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export type ReportFiling =
  /** `hidden` is true when this report was the one that took the room out of discovery. */
  { readonly type: 'filed'; readonly hidden: boolean } | { readonly type: 'duplicate' };

export interface WatchPartyReportRepositoryPort {
  /**
   * One report per reporter per room, or per member. A room report that brings the open room
   * reports from distinct accounts to `hideAt` hides the room in the same transaction.
   */
  file(
    report: WatchPartyReport,
    hideAt: number,
    now: Date
  ): Promise<Result<ReportFiling, DatabaseUnavailable>>;
  /** Lifts the hide and resolves the room's open reports; `false` when the room is gone. */
  restore(roomId: string, at: Date): Promise<Result<boolean, DatabaseUnavailable>>;
}
