import type { NotificationKind, NotificationPayload } from '@vp/domain';
import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { videoComments } from './comments-schema';
import { channels, users, videos } from './schema';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<NotificationKind>().notNull(),
    actorChannelId: uuid('actor_channel_id').references(() => channels.id, {
      onDelete: 'set null',
    }),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => videoComments.id, { onDelete: 'cascade' }),
    groupKey: text('group_key'),
    payload: jsonb('payload').$type<NotificationPayload>().notNull(),
    readAt: timestamptz('read_at'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_newest_idx').on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('notifications_user_unread_idx')
      .on(table.userId, table.groupKey)
      .where(sql`${table.readAt} IS NULL`),
    index('notifications_created_at_idx').on(table.createdAt),
  ]
);
