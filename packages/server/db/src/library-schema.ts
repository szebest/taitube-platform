import { PLAYLIST_VISIBILITIES } from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users, videos } from './schema';

const VISIBILITY_LIST = sql.raw(PLAYLIST_VISIBILITIES.map((value) => `'${value}'`).join(', '));

export const playlists = pgTable(
  'playlists',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    visibility: text('visibility', { enum: PLAYLIST_VISIBILITIES }).notNull().default('private'),
    isSystem: boolean('is_system').notNull().default(false),
    customThumbnailKey: text('custom_thumbnail_key'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('playlists_owner_visibility_idx').on(table.ownerId, table.visibility),
    uniqueIndex('playlists_one_system_per_owner_idx')
      .on(table.ownerId)
      .where(sql`${table.isSystem}`),
    check('playlists_visibility_check', sql`${table.visibility} IN (${VISIBILITY_LIST})`),
  ]
);

export const playlistItems = pgTable(
  'playlist_items',
  {
    id: uuid('id').primaryKey(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
  },
  (table) => [
    unique('playlist_items_playlist_video_key').on(table.playlistId, table.videoId),
    index('playlist_items_playlist_position_idx').on(table.playlistId, table.position),
    index('playlist_items_video_idx').on(table.videoId),
  ]
);

export const watchHistory = pgTable(
  'watch_history',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    progressSeconds: integer('progress_seconds').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    watchedAt: timestamptz('watched_at').notNull(),
  },
  (table) => [
    unique('watch_history_user_video_key').on(table.userId, table.videoId),
    index('watch_history_user_watched_idx').on(
      table.userId,
      table.watchedAt.desc(),
      table.id.desc()
    ),
    index('watch_history_video_idx').on(table.videoId),
    check(
      'watch_history_progress_check',
      sql`${table.progressSeconds} >= 0 AND ${table.durationSeconds} > 0`
    ),
  ]
);
