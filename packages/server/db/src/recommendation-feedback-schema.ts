import { RECOMMENDATION_FEEDBACK_KINDS } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { channels, users, videos } from './schema';

export const recommendationFeedback = pgTable(
  'recommendation_feedback',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: RECOMMENDATION_FEEDBACK_KINDS }).notNull(),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id').references(() => channels.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull(),
  },
  (table) => [
    check(
      'recommendation_feedback_target_check',
      sql`(${table.kind} = 'not_interested' AND ${table.videoId} IS NOT NULL AND ${table.channelId} IS NULL) OR (${table.kind} = 'hide_channel' AND ${table.channelId} IS NOT NULL AND ${table.videoId} IS NULL)`
    ),
    uniqueIndex('recommendation_feedback_user_video_idx')
      .on(table.userId, table.videoId)
      .where(sql`${table.videoId} IS NOT NULL`),
    uniqueIndex('recommendation_feedback_user_channel_idx')
      .on(table.userId, table.channelId)
      .where(sql`${table.channelId} IS NOT NULL`),
    index('recommendation_feedback_user_created_idx').on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc()
    ),
  ]
);
