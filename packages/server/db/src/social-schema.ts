import { index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { channels, users, videos } from './schema';

export const videoReactions = pgTable(
  'video_reactions',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('video_reactions_user_id_video_id_unique').on(table.userId, table.videoId),
    index('video_reactions_video_id_type_idx').on(table.videoId, table.type),
  ]
);

export const channelSubscriptions = pgTable(
  'channel_subscriptions',
  {
    id: uuid('id').primaryKey(),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    unique('channel_subscriptions_subscriber_channel_unique').on(
      table.subscriberId,
      table.channelId
    ),
    index('channel_subscriptions_subscriber_created_idx').on(
      table.subscriberId,
      table.createdAt.desc()
    ),
    index('channel_subscriptions_channel_created_idx').on(table.channelId, table.createdAt.desc()),
  ]
);
