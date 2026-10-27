import { CAPTION_KINDS, CAPTION_STATUSES } from '@vp/domain';
import { type SQL, sql } from 'drizzle-orm';
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { videos } from './schema';

export const captionKindEnum = pgEnum('caption_kind', CAPTION_KINDS);

export const captionStatusEnum = pgEnum('caption_status', CAPTION_STATUSES);

/**
 * One row per track. A video has at most one generated track (`auto` or `edited`), which has no
 * language until speech-to-text detects one, and one track per language.
 */
export const videoCaptions = pgTable(
  'video_captions',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    language: text('language'),
    detectedLanguage: text('detected_language'),
    kind: captionKindEnum('kind').notNull(),
    status: captionStatusEnum('status').notNull(),
    modelVersion: text('model_version'),
    reason: text('reason'),
    version: integer('version').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('video_captions_video_language_idx').on(table.videoId, table.language),
    uniqueIndex('video_captions_generated_idx')
      .on(table.videoId)
      .where(sql`${table.kind} <> 'uploaded'`),
    index('video_captions_pending_idx').on(table.updatedAt).where(sql`${table.status} = 'pending'`),
  ]
);

export const videoTranscriptCues = pgTable(
  'video_transcript_cues',
  {
    captionId: uuid('caption_id')
      .notNull()
      .references(() => videoCaptions.id, { onDelete: 'cascade' }),
    cueIndex: integer('cue_index').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
  },
  (table) => [primaryKey({ columns: [table.captionId, table.cueIndex] })]
);

/**
 * Like `searchVectors`, the generated `text_vector` and its GIN index exist only in the migration,
 * built with `SEARCH_TEXT_CONFIG`, so a select of a cue never carries the vector.
 */
export const transcriptVector: SQL = sql`${videoTranscriptCues}."text_vector"`;
