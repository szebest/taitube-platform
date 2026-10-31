import { FEATURED_VIDEOS_MAX } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { check, integer, pgTable, primaryKey, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { channels, videos } from './schema';

export const channelFeaturedVideos = pgTable(
  'channel_featured_videos',
  {
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.channelId, table.videoId] }),
    unique('channel_featured_videos_channel_position_key').on(table.channelId, table.position),
    check(
      'channel_featured_videos_position_check',
      sql`${table.position} BETWEEN 0 AND ${sql.raw(String(FEATURED_VIDEOS_MAX - 1))}`
    ),
  ]
);
