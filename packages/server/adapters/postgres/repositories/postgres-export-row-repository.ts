import type { ExportRowRepositoryPort, ExportScope } from '@vp/core/repositories';
import type {
  ChannelAnalyticsExportRow,
  CommentExportRow,
  ExportRowPage,
  VideoAnalyticsExportRow,
  VideoExportRow,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { fromPromise, type Result } from '@vp/result';
import { z } from 'zod';
import { channelDayRows, retentionRows, videoDailyRows } from './export-analytics-queries';
import { commentRows, videoRows } from './export-catalogue-queries';
import type { PostgresDatabase } from './types';

const VideoAnalyticsCursor = z.discriminatedUnion('series', [
  z.object({ series: z.literal('daily'), videoId: z.uuid(), day: z.iso.date() }),
  z.object({ series: z.literal('retention'), videoId: z.uuid(), percent: z.number().int() }),
]);
const DayCursor = z.object({ day: z.iso.date() });
const CreatedCursor = z.object({ createdAt: z.iso.datetime(), id: z.uuid() });

type Page<Row> = Promise<Result<ExportRowPage<Row>, DatabaseUnavailable>>;

function decode<T>(schema: z.ZodType<T>, after: string | null): T | null {
  return after === null ? null : schema.parse(JSON.parse(after));
}

/** A full page may have more behind it, so it carries where to go on; a short one is the last. */
function pageOf<Row>(
  rows: Row[],
  limit: number,
  cursorOf: (last: Row) => object
): ExportRowPage<Row> {
  const last = rows.at(-1);
  return {
    rows,
    next: rows.length === limit && last !== undefined ? JSON.stringify(cursorOf(last)) : null,
  };
}

const createdKey = (after: string | null) => {
  const cursor = decode(CreatedCursor, after);
  return cursor && { createdAt: new Date(cursor.createdAt), id: cursor.id };
};

export class PostgresExportRowRepository implements ExportRowRepositoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  /** Two walks in one cursor: the daily rows, then the retention steps once the days run out. */
  async videoAnalytics(
    scope: ExportScope,
    after: string | null,
    limit: number
  ): Page<VideoAnalyticsExportRow> {
    return fromPromise(async () => {
      const cursor = decode(VideoAnalyticsCursor, after);
      const daily =
        cursor?.series === 'retention'
          ? []
          : await videoDailyRows(
              this.db,
              scope,
              cursor && { videoId: cursor.videoId, day: cursor.day },
              limit
            );
      const retentionAfter = cursor?.series === 'retention' ? cursor : null;
      const retention =
        daily.length < limit
          ? await retentionRows(this.db, scope, retentionAfter, limit - daily.length)
          : [];

      return pageOf([...daily, ...retention], limit, (last) =>
        last.series === 'daily'
          ? { series: 'daily', videoId: last.videoId, day: last.day }
          : { series: 'retention', videoId: last.videoId, percent: last.percent }
      );
    }, databaseUnavailable.during('exportVideoAnalytics'));
  }

  async channelAnalytics(
    scope: ExportScope,
    after: string | null,
    limit: number
  ): Page<ChannelAnalyticsExportRow> {
    return fromPromise(async () => {
      const rows = await channelDayRows(
        this.db,
        scope,
        decode(DayCursor, after)?.day ?? null,
        limit
      );
      return pageOf(rows, limit, ({ day }) => ({ day }));
    }, databaseUnavailable.during('exportChannelAnalytics'));
  }

  async comments(scope: ExportScope, after: string | null, limit: number): Page<CommentExportRow> {
    return fromPromise(async () => {
      const rows = await commentRows(this.db, scope, createdKey(after), limit);
      return pageOf(rows, limit, ({ createdAt, commentId }) => ({ createdAt, id: commentId }));
    }, databaseUnavailable.during('exportComments'));
  }

  async videos(scope: ExportScope, after: string | null, limit: number): Page<VideoExportRow> {
    return fromPromise(async () => {
      const rows = await videoRows(this.db, scope, createdKey(after), limit);
      return pageOf(rows, limit, ({ createdAt, videoId }) => ({ createdAt, id: videoId }));
    }, databaseUnavailable.during('exportVideos'));
  }
}
