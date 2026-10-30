import { CLIP_MAX_MS, CLIP_MIN_MS } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users, videos } from './schema';

export const clips = pgTable(
  'clips',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    title: text('title').notNull(),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    index('clips_user_created_idx').on(table.userId, table.createdAt.desc(), table.id.desc()),
    index('clips_video_idx').on(table.videoId),
    check(
      'clips_range_check',
      sql`${table.startMs} >= 0 AND ${table.endMs} - ${table.startMs} BETWEEN ${sql.raw(String(CLIP_MIN_MS))} AND ${sql.raw(String(CLIP_MAX_MS))}`
    ),
  ]
);
