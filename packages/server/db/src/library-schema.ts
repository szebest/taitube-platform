import {
  DEFAULT_PLAYLIST_VISIBILITY,
  PLAYLIST_COVER_MODES,
  PLAYLIST_ITEM_KINDS,
  PLAYLIST_KINDS,
  PLAYLIST_SEGMENT_MIN_MS,
  PLAYLIST_VISIBILITIES,
  type PlaylistCoverMode,
  type PlaylistItemKind,
} from '@vp/domain';
import { PLAYLIST_NOTE_MAX_LENGTH, PLAYLIST_SECTION_TITLE_MAX_LENGTH } from '@vp/validation';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  type AnyPgColumn,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { users, videos } from './schema';

export const playlists = pgTable(
  'playlists',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    visibility: text('visibility', { enum: PLAYLIST_VISIBILITIES })
      .notNull()
      .default(DEFAULT_PLAYLIST_VISIBILITY),
    kind: text('kind', { enum: PLAYLIST_KINDS }).notNull().default('playlist'),
    isSystem: boolean('is_system').notNull().default(false),
    customThumbnailKey: text('custom_thumbnail_key'),
    rules: jsonb('rules'),
    autoRemoveWatched: boolean('auto_remove_watched').notNull().default(false),
    pinnedAt: timestamptz('pinned_at'),
    forkedFromPlaylistId: uuid('forked_from_playlist_id').references(
      (): AnyPgColumn => playlists.id,
      { onDelete: 'set null' }
    ),
    coverMode: text('cover_mode').$type<PlaylistCoverMode>().notNull().default('auto'),
    coverVideoId: uuid('cover_video_id').references(() => videos.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('playlists_owner_visibility_idx').on(table.ownerId, table.visibility),
    uniqueIndex('playlists_one_system_per_owner_idx')
      .on(table.ownerId)
      .where(sql`${table.isSystem}`),
    index('playlists_owner_pinned_idx')
      .on(table.ownerId, table.pinnedAt)
      .where(sql`${table.pinnedAt} IS NOT NULL`),
    check(
      'playlists_visibility_check',
      sql`${table.visibility} IN (${listOf(PLAYLIST_VISIBILITIES)})`
    ),
    check('playlists_kind_check', sql`${table.kind} IN (${listOf(PLAYLIST_KINDS)})`),
    check(
      'playlists_cover_mode_check',
      sql`${table.coverMode} IN (${listOf(PLAYLIST_COVER_MODES)})`
    ),
  ]
);

export const playlistItems = pgTable(
  'playlist_items',
  {
    id: uuid('id').primaryKey(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id').references(() => videos.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<PlaylistItemKind>().notNull().default('video'),
    title: text('title'),
    position: integer('position').notNull(),
    addedBy: uuid('added_by').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    startMs: integer('start_ms'),
    endMs: integer('end_ms'),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
  },
  (table) => [
    unique('playlist_items_playlist_video_key').on(table.playlistId, table.videoId),
    index('playlist_items_playlist_position_idx').on(table.playlistId, table.position),
    index('playlist_items_video_idx').on(table.videoId),
    check('playlist_items_kind_check', sql`${table.kind} IN (${listOf(PLAYLIST_ITEM_KINDS)})`),
    check(
      'playlist_items_shape_check',
      sql`(${table.kind} = 'video' AND ${table.videoId} IS NOT NULL AND ${table.title} IS NULL) OR (${table.kind} = 'section' AND ${table.videoId} IS NULL AND ${table.title} IS NOT NULL AND ${table.startMs} IS NULL AND ${table.endMs} IS NULL)`
    ),
    check(
      'playlist_items_title_check',
      sql`${table.title} IS NULL OR char_length(${table.title}) BETWEEN 1 AND ${sql.raw(String(PLAYLIST_SECTION_TITLE_MAX_LENGTH))}`
    ),
    check(
      'playlist_items_note_check',
      sql`${table.note} IS NULL OR char_length(${table.note}) <= ${sql.raw(String(PLAYLIST_NOTE_MAX_LENGTH))}`
    ),
    check(
      'playlist_items_segment_check',
      sql`(${table.startMs} IS NULL OR ${table.startMs} >= 0) AND (${table.endMs} IS NULL OR ${table.endMs} >= ${sql.raw(String(PLAYLIST_SEGMENT_MIN_MS))}) AND (${table.startMs} IS NULL OR ${table.endMs} IS NULL OR ${table.endMs} - ${table.startMs} >= ${sql.raw(String(PLAYLIST_SEGMENT_MIN_MS))})`
    ),
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
