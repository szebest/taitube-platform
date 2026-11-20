import { type Failure } from '@kit/errors';
import { DATA_EXPORT_LIMITS } from '@vp/domain';
import { ErrorCodes } from '@vp/errors';

export type ExportNotFound = Failure<typeof ErrorCodes.EXPORT_NOT_FOUND, { exportId: string }>;

export type ExportInProgress = Failure<typeof ErrorCodes.EXPORT_IN_PROGRESS>;

export type ExportDailyLimit = Failure<typeof ErrorCodes.EXPORT_DAILY_LIMIT, { limit: number }>;

export type ExportTooLarge = Failure<
  typeof ErrorCodes.EXPORT_TOO_LARGE,
  { maxRows: number; maxBytes: number }
>;

export function exportNotFound(exportId: string): ExportNotFound {
  return { code: ErrorCodes.EXPORT_NOT_FOUND, message: 'Export not found', exportId };
}

export function exportInProgress(): ExportInProgress {
  return {
    code: ErrorCodes.EXPORT_IN_PROGRESS,
    message: 'An export of this channel is already queued or running',
  };
}

export function exportDailyLimit(): ExportDailyLimit {
  const limit = DATA_EXPORT_LIMITS.perDay;
  return {
    code: ErrorCodes.EXPORT_DAILY_LIMIT,
    message: `At most ${limit} exports a day`,
    limit,
  };
}

export function exportTooLarge(): ExportTooLarge {
  const { maxRows, maxBytes } = DATA_EXPORT_LIMITS;
  return {
    code: ErrorCodes.EXPORT_TOO_LARGE,
    message: `The export is over ${maxRows} rows or ${maxBytes / 1024 / 1024} MB; narrow the range`,
    maxRows,
    maxBytes,
  };
}
