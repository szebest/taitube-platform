import { SCREENING_DECISIONS, SCREENING_OUTCOMES, type ScreeningFinding } from '@vp/domain';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamptz } from './columns';
import { users, videos } from './schema';

const quoted = (values: readonly string[]) => sql.raw(values.map((v) => `'${v}'`).join(', '));

/**
 * One result per video and source checksum, so a re-run reads what the first run stored. The reasons
 * hold the findings that held the video, the flags the ones that only raise a case for a moderator.
 */
export const videoScreenings = pgTable(
  'video_screenings',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    sourceChecksum: text('source_checksum').notNull(),
    outcome: text('outcome', { enum: SCREENING_OUTCOMES }).notNull(),
    score: doublePrecision('score').notNull(),
    reasons: jsonb('reasons').$type<ScreeningFinding[]>().notNull().default([]),
    flags: jsonb('flags').$type<ScreeningFinding[]>().notNull().default([]),
    modelVersion: text('model_version'),
    thresholdVersion: text('threshold_version').notNull(),
    decision: text('decision', { enum: SCREENING_DECISIONS }),
    decidedBy: uuid('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamptz('decided_at'),
    decisionNote: text('decision_note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('video_screenings_video_checksum_idx').on(table.videoId, table.sourceChecksum),
    index('video_screenings_open_idx')
      .on(table.createdAt.desc())
      .where(
        sql`${table.decision} IS NULL AND (${table.outcome} = 'HOLD' OR ${table.flags} <> '[]'::jsonb)`
      ),
    check(
      'video_screenings_outcome_check',
      sql`${table.outcome} IN (${quoted(SCREENING_OUTCOMES)})`
    ),
    check(
      'video_screenings_decision_check',
      sql`${table.decision} IS NULL OR ${table.decision} IN (${quoted(SCREENING_DECISIONS)})`
    ),
  ]
);

/**
 * A 64-bit dHash per sampled frame, split into four 16-bit bands, each indexed: a frame within
 * Hamming distance 3 of another agrees with it on at least one band exactly, so a lookup is four
 * index hits and an exact distance check. The bands are signed, as `int4` holds them.
 */
export const videoFrameHashes = pgTable(
  'video_frame_hashes',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    hash: bigint('hash', { mode: 'bigint' }).notNull(),
    b0: integer('b0').notNull(),
    b1: integer('b1').notNull(),
    b2: integer('b2').notNull(),
    b3: integer('b3').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.idx] }),
    index('video_frame_hashes_b0_idx').on(table.b0),
    index('video_frame_hashes_b1_idx').on(table.b1),
    index('video_frame_hashes_b2_idx').on(table.b2),
    index('video_frame_hashes_b3_idx').on(table.b3),
  ]
);

/**
 * The Chromaprint sub-fingerprints of the audio that make up the inverted index: a subsample of the
 * video's terms (`idx` is the term's position in the full sequence), looked up by exact value.
 */
export const videoAudioFingerprints = pgTable(
  'video_audio_fingerprints',
  {
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    term: integer('term').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.videoId, table.idx] }),
    index('video_audio_fingerprints_term_idx').on(table.term),
  ]
);

export const screeningAppeals = pgTable(
  'screening_appeals',
  {
    id: uuid('id').primaryKey(),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    screeningId: uuid('screening_id')
      .notNull()
      .references(() => videoScreenings.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    rejectedBy: uuid('rejected_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamptz('resolved_at'),
  },
  (table) => [
    index('screening_appeals_video_idx').on(table.videoId, table.createdAt.desc()),
    uniqueIndex('screening_appeals_open_idx')
      .on(table.videoId)
      .where(sql`${table.resolvedAt} IS NULL`),
  ]
);
