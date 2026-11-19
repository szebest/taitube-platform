import { MS_PER_DAY } from '@kit/primitives';
import type { ViewDate } from './views';

/** One member per dataset a channel can take away; each has its row schema in `@vp/api-contracts`. */
export const DATA_EXPORT_KINDS = [
  'video_analytics',
  'channel_analytics',
  'comments',
  'videos',
] as const;

export type DataExportKind = (typeof DATA_EXPORT_KINDS)[number];

/** The kinds an analytics viewer may export: the numbers, never the people or the catalogue. */
export const ANALYTICS_EXPORT_KINDS = [
  'video_analytics',
  'channel_analytics',
] as const satisfies readonly DataExportKind[];

export const DATA_EXPORT_FORMATS = ['csv', 'json'] as const;

export type DataExportFormat = (typeof DATA_EXPORT_FORMATS)[number];

export const DATA_EXPORT_STATUSES = ['queued', 'running', 'ready', 'failed', 'expired'] as const;

export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

/**
 * Every edge of an export's status. `DATA_EXPORT` in `@vp/domain-rules` is the machine over it;
 * the table lives here so the repositories can guard a write with the statuses it leaves. `start`
 * leaves `running` too, because a job the queue retries after a crash starts its export again.
 */
export const DATA_EXPORT_EDGES = {
  start: { from: ['queued', 'running'], to: 'running' },
  finish: { from: ['running'], to: 'ready' },
  fail: { from: ['queued', 'running'], to: 'failed' },
  expire: { from: ['ready'], to: 'expired' },
} as const satisfies Record<string, { from: readonly DataExportStatus[]; to: DataExportStatus }>;

export const DATA_EXPORT_LIMITS = {
  perDay: 10,
  maxRows: 1_000_000,
  maxBytes: 500 * 1024 * 1024,
  ttlDays: 7,
} as const;

/** An export still unsettled a day after it was asked for lost its job, and is failed so the channel can ask again. */
export const DATA_EXPORT_STALE_AFTER_MS = MS_PER_DAY;

/** Rows a job pulls per keyset page: memory holds one page, whatever the export's size. */
export const DATA_EXPORT_PAGE_SIZE = 1000;

/** Both ends inclusive; an absent end is open, so no range at all is everything the data covers. */
export interface DataExportParams {
  from?: ViewDate;
  to?: ViewDate;
}

export interface DataExport {
  id: string;
  channelId: string;
  requestedBy: string | null;
  kind: DataExportKind;
  params: DataExportParams;
  format: DataExportFormat;
  status: DataExportStatus;
  /** Set while the file exists: from `ready` until it expires. */
  objectKey: string | null;
  rowCount: number | null;
  failure: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export type NewDataExport = Pick<
  DataExport,
  'id' | 'channelId' | 'requestedBy' | 'kind' | 'params' | 'format'
>;

/** What a channel has under way and asked for in the last day, read before a new request. */
export interface DataExportUsage {
  running: boolean;
  today: number;
}

export function dataExportExpiry(readyAt: Date): Date {
  return new Date(readyAt.getTime() + DATA_EXPORT_LIMITS.ttlDays * MS_PER_DAY);
}
