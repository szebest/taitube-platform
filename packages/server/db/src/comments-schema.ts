import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users, videos } from './schema';

export const videoComments = pgTable(
  'video_comments',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => videoComments.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),
    isEdited: boolean('is_edited').notNull().default(false),
    likeCount: integer('like_count').notNull().default(0),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
    deletedAt: timestamptz('deleted_at'),
  },
  (table) => [
    index('video_comments_top_idx').on(
      table.videoId,
      table.parentId,
      table.isPinned.desc(),
      table.likeCount.desc(),
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('video_comments_newest_idx').on(
      table.videoId,
      table.parentId,
      table.isPinned.desc(),
      table.createdAt.desc(),
      table.id.desc()
    ),
    uniqueIndex('video_comments_one_pinned_per_video_idx')
      .on(table.videoId)
      .where(sql`${table.isPinned} AND ${table.deletedAt} IS NULL`),
  ]
);
