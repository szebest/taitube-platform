import {
  type BlurRegion,
  GENERATION_KINDS,
  GENERATION_STATUSES,
  type GenerationKind,
  type GenerationPlayback,
  type GenerationStatus,
  type GenerationTimeline,
  MAX_BLURS,
  type RetentionPoint,
  type TimeRange,
  VIDEO_EDIT_STATUSES,
  type VideoEditStatus,
} from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
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
import { videos } from './schema';

/**
 * One row per rendered generation of a video. `videos.generation` names the one playing; a row turns
 * `active` only in the swap that points the video at it, and the swap writes the outgoing row's playback,
 * timeline and retention so a swap back restores them. `lock_token` fences the render that claimed it.
 */
export const videoGenerations = pgTable(
  'video_generations',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    generation: integer('generation').notNull(),
    kind: text('kind').$type<GenerationKind>().notNull(),
    status: text('status').$type<GenerationStatus>().notNull(),
    sourceKey: text('source_key'),
    baseGeneration: integer('base_generation'),
    replacesGeneration: integer('replaces_generation').notNull(),
    playback: jsonb('playback').$type<GenerationPlayback>(),
    timeline: jsonb('timeline').$type<GenerationTimeline>(),
    retention: jsonb('retention').$type<RetentionPoint[]>(),
    needsReview: boolean('needs_review').notNull().default(false),
    errorCode: text('error_code'),
    lockToken: uuid('lock_token'),
    purgeAfter: timestamptz('purge_after'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.generation] }),
    uniqueIndex('video_generations_in_flight_idx')
      .on(table.videoId)
      .where(sql`${table.status} IN ('uploading', 'rendering')`),
    index('video_generations_purge_idx')
      .on(table.purgeAfter)
      .where(sql`${table.purgeAfter} IS NOT NULL`),
    check('video_generations_kind_check', sql`${table.kind} IN (${listOf(GENERATION_KINDS)})`),
    check(
      'video_generations_status_check',
      sql`${table.status} IN (${listOf(GENERATION_STATUSES)})`
    ),
    check('video_generations_generation_check', sql`${table.generation} >= 1`),
  ]
);

/** A video's edit list, on its base generation's timeline, and the generation it renders into. */
export const videoEdits = pgTable(
  'video_edits',
  {
    videoId: uuid('video_id')
      .primaryKey()
      .references(() => videos.id, { onDelete: 'cascade' }),
    baseGeneration: integer('base_generation').notNull(),
    generation: integer('generation').notNull(),
    trim: jsonb('trim').$type<TimeRange>(),
    blurs: jsonb('blurs').$type<BlurRegion[]>().notNull().default([]),
    status: text('status').$type<VideoEditStatus>().notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    check('video_edits_status_check', sql`${table.status} IN (${listOf(VIDEO_EDIT_STATUSES)})`),
    check(
      'video_edits_blurs_check',
      sql`jsonb_array_length(${table.blurs}) <= ${sql.raw(String(MAX_BLURS))}`
    ),
  ]
);
