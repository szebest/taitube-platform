import {
  CHAPTER_TITLE_MAX_LENGTH,
  CORRECTION_MAX_MS,
  CORRECTION_MIN_MS,
  CORRECTION_TEXT_MAX_LENGTH,
  ENTITY_REVISION_TYPES,
  type EntityRevisionType,
  type EntitySnapshots,
  REVISION_NOTE_MAX_LENGTH,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listOf, timestamptz } from './columns';
import { users, videos } from './schema';

export const entityRevisions = pgTable(
  'entity_revisions',
  {
    id: uuid('id').primaryKey(),
    entityType: text('entity_type').$type<EntityRevisionType>().notNull(),
    entityId: uuid('entity_id').notNull(),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').$type<EntitySnapshots[EntityRevisionType]>().notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('entity_revisions_entity_version_idx').on(
      table.entityType,
      table.entityId,
      table.version
    ),
    check(
      'entity_revisions_type_check',
      sql`${table.entityType} IN (${listOf(ENTITY_REVISION_TYPES)})`
    ),
    check(
      'entity_revisions_note_check',
      sql`${table.note} IS NULL OR char_length(${table.note}) <= ${sql.raw(String(REVISION_NOTE_MAX_LENGTH))}`
    ),
  ]
);

export const videoChapters = pgTable(
  'video_chapters',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    startMs: integer('start_ms').notNull(),
    title: text('title').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.position] }),
    check('video_chapters_start_check', sql`${table.startMs} >= 0`),
    check(
      'video_chapters_title_check',
      sql`char_length(${table.title}) BETWEEN 1 AND ${sql.raw(String(CHAPTER_TITLE_MAX_LENGTH))}`
    ),
  ]
);

export const videoCorrections = pgTable(
  'video_corrections',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('video_corrections_video_idx').on(table.videoId, table.startMs),
    check(
      'video_corrections_range_check',
      sql`${table.startMs} >= 0 AND ${table.endMs} - ${table.startMs} BETWEEN ${sql.raw(String(CORRECTION_MIN_MS))} AND ${sql.raw(String(CORRECTION_MAX_MS))}`
    ),
    check(
      'video_corrections_text_check',
      sql`char_length(${table.text}) BETWEEN 1 AND ${sql.raw(String(CORRECTION_TEXT_MAX_LENGTH))}`
    ),
  ]
);
