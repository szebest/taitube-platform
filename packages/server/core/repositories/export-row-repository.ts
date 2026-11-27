import type { Result } from '@kit/result';
import type {
  ChannelAnalyticsExportRow,
  CommentExportRow,
  DataExportParams,
  ExportRowPage,
  PostExportRow,
  VideoAnalyticsExportRow,
  VideoExportRow,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

/** The channel an export reads, by its id and its owner's user id, and the days it is narrowed to. */
export interface ExportScope {
  channelId: string;
  ownerId: string;
  range: DataExportParams;
}

type Page<Row> = Promise<Result<ExportRowPage<Row>, DatabaseUnavailable>>;

/**
 * Each dataset an export can hold, read a keyset page at a time in a stable order: pass the `next`
 * of one page as `after` to read the one behind it. Deleted videos and removed comments are not read.
 */
export interface ExportRowRepositoryPort {
  /** Every daily row of every video, then every step of every retention curve. */
  videoAnalytics(
    scope: ExportScope,
    after: string | null,
    limit: number
  ): Page<VideoAnalyticsExportRow>;
  /** One row per day with views or subscriber changes. */
  channelAnalytics(
    scope: ExportScope,
    after: string | null,
    limit: number
  ): Page<ChannelAnalyticsExportRow>;
  comments(scope: ExportScope, after: string | null, limit: number): Page<CommentExportRow>;
  videos(scope: ExportScope, after: string | null, limit: number): Page<VideoExportRow>;
  /** Every post of the channel in any status, oldest first. */
  posts(scope: ExportScope, after: string | null, limit: number): Page<PostExportRow>;
}
