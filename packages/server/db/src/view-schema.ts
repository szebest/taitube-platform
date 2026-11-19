import { VIEW_DEVICES, type ViewDevice } from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { videos } from './schema';

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

export const videoViewsDeviceDaily = pgTable(
  'video_views_device_daily',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    viewDate: date('view_date', { mode: 'string' }).notNull(),
    device: text('device').$type<ViewDevice>().notNull(),
    views: integer('views').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.viewDate, table.device] }),
    check(
      'video_views_device_daily_device_check',
      sql`${table.device} IN (${listOf(VIEW_DEVICES)})`
    ),
  ]
);

export const videoViewsHourly = pgTable(
  'video_views_hourly',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    viewHour: timestamptz('view_hour').notNull(),
    views: integer('views').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.viewHour] }),
    index('video_views_hourly_hour_idx').on(table.viewHour),
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

export const videoRetentionMilestones = pgTable(
  'video_retention_milestones',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    percent: smallint('percent').notNull(),
    viewers: bigint('viewers', { mode: 'number' }).notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.videoId, table.percent] })]
);
