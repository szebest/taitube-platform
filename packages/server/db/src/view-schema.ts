import { bigint, date, index, integer, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz, videos } from './schema';

export const videoViewsDaily = pgTable(
  'video_views_daily',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    viewDate: date('view_date', { mode: 'string' }).notNull(),
    views: integer('views').notNull().default(0),
    watchSeconds: bigint('watch_seconds', { mode: 'number' }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.viewDate] }),
    index('video_views_daily_date_video_idx').on(table.viewDate.desc(), table.videoId),
  ]
);

export const videoViewBatches = pgTable(
  'video_view_batches',
  {
    batchId: text('batch_id').primaryKey(),
    appliedAt: timestamptz('applied_at').notNull().defaultNow(),
  },
  (table) => [index('video_view_batches_applied_at_idx').on(table.appliedAt)]
);
